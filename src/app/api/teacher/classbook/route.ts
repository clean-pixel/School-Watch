import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  classId: z.string().uuid(),
  subject: z.string().trim().min(1).max(100),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.number().int().min(1).max(12).nullable().optional(),
  lessonTopic: z.string().trim().min(1).max(200),
  lessonContent: z.string().max(12000).default(""),
  homework: z.string().max(4000).default(""),
  teacherNotes: z.string().max(4000).default(""),
  attendance: z.array(z.object({
    studentId: z.string().uuid(),
    status: z.enum(["present", "absent", "late", "excused"]),
  })).max(120).default([]),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte prüfe die Klassenbucheinträge und Anwesenheit." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Das Klassenbuch ist nur für freigegebene Lehrkräfte verfügbar." }, { status: 403 });
    }

    const [assignment, classResult, membershipResult] = await Promise.all([
      supabase.from("teacher_assignments").select("id")
        .eq("school_id", profile.school_id).eq("class_id", parsed.data.classId)
        .eq("teacher_id", user.id).eq("subject", parsed.data.subject).maybeSingle(),
      supabase.from("classes").select("id").eq("id", parsed.data.classId).eq("school_id", profile.school_id).maybeSingle(),
      supabase.from("class_memberships").select("student_id")
        .eq("school_id", profile.school_id).eq("class_id", parsed.data.classId),
    ]);
    if (!assignment.data || assignment.error || !classResult.data || classResult.error) {
      return NextResponse.json({ error: "Du bist dieser Klasse und diesem Fach nicht zugeordnet." }, { status: 403 });
    }
    if (membershipResult.error) return NextResponse.json({ error: "Die Klassenliste konnte nicht geprüft werden." }, { status: 500 });

    const roster = new Set((membershipResult.data ?? []).map((item) => item.student_id));
    const submittedIds = parsed.data.attendance.map((item) => item.studentId);
    if (new Set(submittedIds).size !== submittedIds.length || submittedIds.some((id) => !roster.has(id))) {
      return NextResponse.json({ error: "Die Anwesenheitsliste enthält Schüler, die nicht zu dieser Klasse gehören." }, { status: 400 });
    }

    const { data: entry, error: entryError } = await supabase.from("classbook_entries").insert({
      school_id: profile.school_id,
      class_id: parsed.data.classId,
      teacher_id: user.id,
      subject: parsed.data.subject,
      lesson_date: parsed.data.lessonDate,
      period: parsed.data.period ?? null,
      lesson_topic: parsed.data.lessonTopic,
      lesson_content: parsed.data.lessonContent,
      homework: parsed.data.homework,
      teacher_notes: parsed.data.teacherNotes,
    }).select("id").single();
    if (entryError || !entry) return NextResponse.json({ error: "Der Unterrichtseintrag konnte nicht gespeichert werden." }, { status: 500 });

    if (parsed.data.attendance.length) {
      const rows = parsed.data.attendance.map((item) => ({
        entry_id: entry.id,
        school_id: profile.school_id,
        student_id: item.studentId,
        status: item.status,
      }));
      const { error: attendanceError } = await supabase.from("classbook_attendance").insert(rows);
      if (attendanceError) {
        await supabase.from("classbook_entries").delete().eq("id", entry.id).eq("teacher_id", user.id);
        return NextResponse.json({ error: "Die Anwesenheit konnte nicht gespeichert werden. Der Eintrag wurde zurückgenommen." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, id: entry.id });
  } catch {
    return NextResponse.json({ error: "Der Klassenbucheintrag konnte nicht gespeichert werden." }, { status: 500 });
  }
}
