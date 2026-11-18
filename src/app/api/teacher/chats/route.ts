import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  classId: z.string().uuid(),
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(160).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte Klasse und Fach auswählen." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Der Lehrer-KI-Chat ist nur für freigegebene Lehrkräfte verfügbar." }, { status: 403 });
    }

    const [assignment, classResult] = await Promise.all([
      supabase.from("teacher_assignments").select("id")
        .eq("school_id", profile.school_id).eq("class_id", parsed.data.classId)
        .eq("teacher_id", user.id).eq("subject", parsed.data.subject).maybeSingle(),
      supabase.from("classes").select("id,name,grade")
        .eq("id", parsed.data.classId).eq("school_id", profile.school_id).maybeSingle(),
    ]);
    if (assignment.error || !assignment.data || classResult.error || !classResult.data) {
      return NextResponse.json({ error: "Du bist dieser Klasse und diesem Fach nicht zugeordnet." }, { status: 403 });
    }

    const title = parsed.data.title || "Neuer Chat · " + parsed.data.subject;
    const { data: chat, error } = await supabase.from("teacher_ai_chats").insert({
      school_id: profile.school_id,
      class_id: parsed.data.classId,
      teacher_id: user.id,
      subject: parsed.data.subject,
      title,
      is_default: false,
    }).select("id,title,subject,class_id,created_at").single();

    if (error || !chat) return NextResponse.json({ error: "Der neue Chat konnte nicht erstellt werden." }, { status: 500 });
    return NextResponse.json({ chat });
  } catch {
    return NextResponse.json({ error: "Der Chat konnte nicht erstellt werden." }, { status: 500 });
  }
}
