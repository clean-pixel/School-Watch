import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse } from "@/lib/openai-responses";

const requestSchema = z.object({
  classId: z.string().uuid(),
  subject: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(3).max(500),
  learningScope: z.string().trim().max(1000).optional(),
  difficulty: z.enum(["leicht", "mittel", "anspruchsvoll"]),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte prüfe Klasse, Fach und Thema." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();
    if (!profile || !["teacher", "school_admin"].includes(profile.role) || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Nur freigegebene Lehrkräfte und die Schulleitung können Arbeitsblätter erstellen." }, { status: 403 });
    }

    const { data: classRow } = await supabase.from("classes")
      .select("id,name,grade")
      .eq("id", parsed.data.classId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (!classRow) return NextResponse.json({ error: "Diese Klasse wurde nicht gefunden." }, { status: 404 });

    if (profile.role === "teacher") {
      const { data: assignment } = await supabase.from("teacher_assignments")
        .select("id")
        .eq("school_id", profile.school_id)
        .eq("class_id", classRow.id)
        .eq("teacher_id", user.id)
        .eq("subject", parsed.data.subject)
        .maybeSingle();
      if (!assignment) return NextResponse.json({ error: "Du bist für dieses Fach in dieser Klasse nicht eingetragen." }, { status: 403 });
    }

    const prompt = `Du erstellst ein druckbares, altersgerechtes Arbeitsblatt für eine deutsche Schule.
Klasse: ${classRow.name} ${classRow.grade ? `(Jahrgang ${classRow.grade})` : ""}
Fach: ${parsed.data.subject}
Thema: ${parsed.data.topic}
Lernziele der Lehrkraft: ${parsed.data.learningScope || "Keine weiteren Lernziele angegeben."}
Schwierigkeitsgrad: ${parsed.data.difficulty}

Erstelle ein übersichtliches Arbeitsblatt mit:
1. Titel und kurzen Arbeitsanweisungen.
2. Einem kurzen Merkkasten mit den nötigen Grundlagen.
3. 6 bis 8 Aufgaben, von leichter zu schwieriger.
4. Einer freiwilligen Knobelaufgabe.
5. Platzhaltern mit Linien/Leerstellen, wo Schüler ihre Antworten notieren.

Wichtig:
- Schreibe KEINE Lösungen, Musterlösungen oder Ergebnisliste.
- Erfinde keine konkreten Lehrplanvorgaben für das Bundesland.
- Nutze Websuche nur für fachliche Fakten, falls nötig, und bevorzuge offizielle Bildungs- oder seriöse Fachquellen.
- Antworte auf Deutsch in sauberer Markdown-Struktur.
- Die Aufgaben müssen eigenständig lösbar und für die angegebene Klasse geeignet sein.`;

    const result = await runOpenAIResponse({ input: prompt, useWebSearch: true, maxOutputTokens: 2400 });
    return NextResponse.json({ worksheet: result.text, citations: result.citations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Das Arbeitsblatt konnte nicht erstellt werden.";
    const status = error instanceof AiConfigurationError ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
