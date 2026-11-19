import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const createClassAction = z.object({
  type: z.literal("create_class"),
  name: z.string().trim().min(1).max(80),
  grade: z.string().trim().max(40).nullable().optional(),
  subjects: z.array(z.string().trim().min(1).max(100)).max(25).default([]),
});
const addSubjectsAction = z.object({
  type: z.literal("add_subjects"),
  className: z.string().trim().min(1).max(80),
  subjects: z.array(z.string().trim().min(1).max(100)).min(1).max(25),
});
const assignTeacherAction = z.object({
  type: z.literal("assign_teacher"),
  className: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(100),
  teacherId: z.string().uuid(),
});
const timetableEntry = z.object({
  weekday: z.number().int().min(1).max(5),
  startsAt: z.string().regex(timePattern),
  endsAt: z.string().regex(timePattern),
  subject: z.string().trim().min(1).max(100),
  room: z.string().trim().max(80).nullable().optional(),
  weekType: z.enum(["both", "A", "B"]).default("both"),
}).refine((item) => item.endsAt > item.startsAt, { message: "Die Endzeit muss nach der Startzeit liegen." });
const timetableAction = z.object({
  type: z.literal("create_timetable"),
  className: z.string().trim().min(1).max(80),
  entries: z.array(timetableEntry).min(1).max(35),
});
const actionSchema = z.discriminatedUnion("type", [
  createClassAction,
  addSubjectsAction,
  assignTeacherAction,
  timetableAction,
]);
const requestSchema = z.object({ actions: z.array(actionSchema).min(1).max(60) });

type Entry = z.infer<typeof timetableEntry>;

function overlaps(a: Entry, b: { starts_at: string; ends_at: string; week_type: string }) {
  const weekOverlap = a.weekType === "both" || b.week_type === "both" || a.weekType === b.week_type;
  const timeOverlap = a.startsAt < b.ends_at.slice(0, 5) && a.endsAt > b.starts_at.slice(0, 5);
  return weekOverlap && timeOverlap;
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Die vorgeschlagenen Änderungen sind ungültig." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();

    if (!profile || !["teacher", "school_admin"].includes(profile.role) ||
        profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Für Schuländerungen brauchst du ein freigegebenes Lehrkraft- oder Schulleitungskonto." }, { status: 403 });
    }

    const results: string[] = [];
    let createdCount = 0;

    for (const action of parsed.data.actions) {
      if (action.type === "create_class") {
        if (profile.role !== "school_admin") {
          results.push("Klasse " + action.name + ": Nur die Schulleitung darf Klassen anlegen.");
          continue;
        }

        let classRow = await supabase.from("classes").select("id")
          .eq("school_id", profile.school_id).eq("name", action.name).maybeSingle();
        if (classRow.error) {
          results.push("Klasse " + action.name + ": Bestehende Daten konnten nicht geprüft werden.");
          continue;
        }
        let classId = classRow.data?.id as string | undefined;
        if (!classId) {
          const inserted = await supabase.from("classes").insert({
            school_id: profile.school_id,
            name: action.name,
            grade: action.grade || null,
          }).select("id").single();
          if (inserted.error || !inserted.data) {
            results.push("Klasse " + action.name + ": konnte nicht angelegt werden.");
            continue;
          }
          classId = inserted.data.id;
          createdCount++;
        }

        if (action.subjects.length) {
          const existing = await supabase.from("class_subjects").select("subject")
            .eq("school_id", profile.school_id).eq("class_id", classId);
          if (existing.error) {
            results.push("Klasse " + action.name + ": Klasse vorhanden, Fächer konnten nicht geprüft werden.");
            continue;
          }
          const known = new Set((existing.data ?? []).map((item) => item.subject));
          const missing = [...new Set(action.subjects)].filter((subject) => !known.has(subject));
          if (missing.length) {
            const insertedSubjects = await supabase.from("class_subjects").insert(missing.map((subject) => ({
              school_id: profile.school_id, class_id: classId, subject,
            })));
            if (insertedSubjects.error) {
              results.push("Klasse " + action.name + ": angelegt, aber Fächer konnten nicht vollständig gespeichert werden.");
              continue;
            }
          }
        }
        results.push("Klasse " + action.name + ": " + (classRow.data ? "war bereits vorhanden" : "angelegt") +
          (action.subjects.length ? "; Fächer geprüft/ergänzt." : "."));
        continue;
      }

      if (action.type === "add_subjects") {
        if (profile.role !== "school_admin") {
          results.push("Fächer für " + action.className + ": Nur die Schulleitung darf Klassenfächer ändern.");
          continue;
        }
        const classResult = await supabase.from("classes").select("id")
          .eq("school_id", profile.school_id).eq("name", action.className).maybeSingle();
        const classId = classResult.data?.id;
        if (classResult.error || !classId) {
          results.push("Fächer für " + action.className + ": Klasse nicht gefunden.");
          continue;
        }
        const existing = await supabase.from("class_subjects").select("subject")
          .eq("school_id", profile.school_id).eq("class_id", classId);
        if (existing.error) {
          results.push("Fächer für " + action.className + ": vorhandene Fächer konnten nicht geprüft werden.");
          continue;
        }
        const known = new Set((existing.data ?? []).map((item) => item.subject));
        const missing = [...new Set(action.subjects)].filter((subject) => !known.has(subject));
        if (missing.length) {
          const inserted = await supabase.from("class_subjects").insert(missing.map((subject) => ({
            school_id: profile.school_id, class_id: classId, subject,
          })));
          if (inserted.error) {
            results.push("Fächer für " + action.className + ": Speichern fehlgeschlagen.");
            continue;
          }
        }
        results.push(action.className + ": " + (missing.length ? missing.join(", ") + " ergänzt." : "alle vorgeschlagenen Fächer waren bereits vorhanden."));
        continue;
      }

      if (action.type === "assign_teacher") {
        if (profile.role !== "school_admin") {
          results.push("Zuordnung " + action.className + " / " + action.subject + ": Nur die Schulleitung darf Lehrkräfte zuordnen.");
          continue;
        }
        const classResult = await supabase.from("classes").select("id")
          .eq("school_id", profile.school_id).eq("name", action.className).maybeSingle();
        const classId = classResult.data?.id;
        const teacherResult = await supabase.from("teachers").select("id,subjects")
          .eq("school_id", profile.school_id).eq("id", action.teacherId).maybeSingle();
        const subjectResult = classId
          ? await supabase.from("class_subjects").select("class_id")
              .eq("school_id", profile.school_id).eq("class_id", classId).eq("subject", action.subject).maybeSingle()
          : { data: null, error: null };
        if (classResult.error || !classId || teacherResult.error || !teacherResult.data ||
            subjectResult.error || !subjectResult.data || !(teacherResult.data.subjects ?? []).includes(action.subject)) {
          results.push("Zuordnung " + action.className + " / " + action.subject + ": Klasse, Fach oder Lehrkraft passt nicht zu den Schulzuordnungen.");
          continue;
        }
        const existing = await supabase.from("teacher_assignments").select("id")
          .eq("school_id", profile.school_id).eq("class_id", classId)
          .eq("teacher_id", action.teacherId).eq("subject", action.subject).maybeSingle();
        if (existing.error) {
          results.push("Zuordnung " + action.className + " / " + action.subject + ": konnte nicht geprüft werden.");
          continue;
        }
        if (!existing.data) {
          const inserted = await supabase.from("teacher_assignments").insert({
            school_id: profile.school_id, class_id: classId,
            teacher_id: action.teacherId, subject: action.subject,
          });
          if (inserted.error) {
            results.push("Zuordnung " + action.className + " / " + action.subject + ": Speichern fehlgeschlagen.");
            continue;
          }
          createdCount++;
        }
        results.push("Lehrkraft-Zuordnung für " + action.className + " / " + action.subject + " geprüft.");
        continue;
      }

      if (action.type === "create_timetable") {
        const classResult = await supabase.from("classes").select("id")
          .eq("school_id", profile.school_id).eq("name", action.className).maybeSingle();
        const classId = classResult.data?.id;
        if (classResult.error || !classId) {
          results.push("Stundenplan " + action.className + ": Klasse nicht gefunden.");
          continue;
        }

        let timetableResult = await supabase.from("timetables").select("id")
          .eq("school_id", profile.school_id).eq("class_id", classId)
          .order("created_at").limit(1).maybeSingle();
        if (timetableResult.error) {
          results.push("Stundenplan " + action.className + ": konnte nicht geladen werden.");
          continue;
        }
        let timetableId = timetableResult.data?.id as string | undefined;
        if (!timetableId) {
          const created = await supabase.from("timetables").insert({
            school_id: profile.school_id, class_id: classId, name: "Stundenplan",
          }).select("id").single();
          if (created.error || !created.data) {
            results.push("Stundenplan " + action.className + ": konnte nicht angelegt werden.");
            continue;
          }
          timetableId = created.data.id;
        }

        let savedForClass = 0;
        for (const entry of action.entries) {
          const [subjectResult, assignmentResult] = await Promise.all([
            supabase.from("class_subjects").select("class_id")
              .eq("school_id", profile.school_id).eq("class_id", classId)
              .eq("subject", entry.subject).maybeSingle(),
            (() => {
              let query = supabase.from("teacher_assignments").select("teacher_id")
                .eq("school_id", profile.school_id).eq("class_id", classId)
                .eq("subject", entry.subject);
              if (profile.role === "teacher") query = query.eq("teacher_id", user.id);
              return query.limit(2);
            })(),
          ]);
          if (subjectResult.error || !subjectResult.data || assignmentResult.error || !assignmentResult.data?.length) {
            results.push(action.className + " " + entry.subject + " (" + entry.startsAt + "): kein passendes Fach oder keine Lehrkraft-Zuordnung.");
            continue;
          }
          if (profile.role === "school_admin" && assignmentResult.data.length > 1) {
            results.push(action.className + " " + entry.subject + " (" + entry.startsAt + "): mehrere Lehrkräfte sind zugeordnet; bitte erst eine eindeutige Zuständigkeit festlegen.");
            continue;
          }
          const teacherId = assignmentResult.data[0].teacher_id;
          const teacherResult = await supabase.from("teachers").select("id,subjects")
            .eq("school_id", profile.school_id).eq("id", teacherId).maybeSingle();
          if (teacherResult.error || !teacherResult.data || !(teacherResult.data.subjects ?? []).includes(entry.subject)) {
            results.push(action.className + " " + entry.subject + ": Lehrkraft-Fachprofil stimmt nicht.");
            continue;
          }

          const [classEntries, teacherEntries] = await Promise.all([
            supabase.from("timetable_entries").select("id,starts_at,ends_at,week_type")
              .eq("school_id", profile.school_id).eq("timetable_id", timetableId).eq("weekday", entry.weekday),
            supabase.from("timetable_entries").select("id,starts_at,ends_at,week_type")
              .eq("school_id", profile.school_id).eq("teacher_id", teacherId).eq("weekday", entry.weekday),
          ]);
          if (classEntries.error || teacherEntries.error) {
            results.push(action.className + " " + entry.subject + ": Konflikte konnten nicht geprüft werden.");
            continue;
          }
          const classConflict = (classEntries.data ?? []).some((existing) => overlaps(entry, existing));
          const teacherConflict = (teacherEntries.data ?? []).some((existing) => overlaps(entry, existing));
          if (classConflict || teacherConflict) {
            results.push(action.className + " " + entry.subject + " " + entry.startsAt + ": " +
              (classConflict ? "Klassen-Zeitkonflikt." : "Lehrkraft-Zeitkonflikt."));
            continue;
          }

          const inserted = await supabase.from("timetable_entries").insert({
            school_id: profile.school_id,
            timetable_id: timetableId,
            weekday: entry.weekday,
            starts_at: entry.startsAt,
            ends_at: entry.endsAt,
            subject: entry.subject,
            room: entry.room || null,
            teacher_id: teacherId,
            week_type: entry.weekType,
          });
          if (inserted.error) {
            results.push(action.className + " " + entry.subject + " " + entry.startsAt + ": Speichern fehlgeschlagen.");
            continue;
          }
          savedForClass++;
          createdCount++;
        }
        results.push("Stundenplan " + action.className + ": " + savedForClass + " von " + action.entries.length + " Stunden gespeichert.");
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/timetable");
    revalidatePath("/dashboard/schule-setup");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/teachers");

    return NextResponse.json({
      success: true,
      createdCount,
      results,
      summary: createdCount
        ? createdCount + " Änderung(en) gespeichert. " + results.join(" ")
        : results.join(" "),
    });
  } catch (error) {
    console.error("[SchulWatch AI actions] Request failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Die vorgeschlagenen Änderungen konnten nicht gespeichert werden. Bitte prüfe deine Berechtigungen und die Schulzuordnungen." }, { status: 500 });
  }
}
