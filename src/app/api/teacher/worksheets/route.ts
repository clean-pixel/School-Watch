import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  chatId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  topic: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(20000),
  publish: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte prüfe Titel und Inhalt des Arbeitsblatts." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Keine Berechtigung zum Speichern." }, { status: 403 });
    }

    const { data: chat } = await supabase.from("teacher_ai_chats")
      .select("id,school_id,class_id,subject").eq("id", parsed.data.chatId)
      .eq("teacher_id", user.id).eq("school_id", profile.school_id).maybeSingle();
    if (!chat) return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });

    const assignment = await supabase.from("teacher_assignments").select("id")
      .eq("school_id", profile.school_id).eq("class_id", chat.class_id)
      .eq("teacher_id", user.id).eq("subject", chat.subject).maybeSingle();
    if (!assignment.data || assignment.error) return NextResponse.json({ error: "Keine passende Fachzuordnung gefunden." }, { status: 403 });

    const marker = "[[MUSTERLÖSUNG_NUR_LEHRKRAFT]]";
    const markerIndex = parsed.data.content.indexOf(marker);
    if (markerIndex < 0) {
      return NextResponse.json({ error: "Das Arbeitsblatt hat keine klar getrennte Musterlösung. Bitte lass die KI das Blatt neu erstellen, bevor du es speicherst." }, { status: 400 });
    }
    const studentContent = parsed.data.content.slice(0, markerIndex).trim();
    if (!studentContent) return NextResponse.json({ error: "Das Arbeitsblatt enthält keinen Schülerteil." }, { status: 400 });

    const { data, error } = await supabase.from("lesson_worksheets").insert({
      school_id: profile.school_id,
      class_id: chat.class_id,
      teacher_id: user.id,
      subject: chat.subject,
      title: parsed.data.title,
      topic: parsed.data.topic,
      content: studentContent,
      is_published: parsed.data.publish,
    }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Arbeitsblatt konnte nicht gespeichert werden." }, { status: 500 });

    return NextResponse.json({ success: true, id: data.id });
  } catch {
    return NextResponse.json({ error: "Arbeitsblatt konnte nicht gespeichert werden." }, { status: 500 });
  }
}
