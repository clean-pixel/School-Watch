import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse } from "@/lib/openai-responses";

const schema = z.object({
  homeworkId: z.string().uuid().optional(),
  message: z.string().trim().min(2).max(2000),
  attempt: z.string().trim().max(3000).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte gib eine Frage ein." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "student" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Die Lern-KI ist nur für freigegebene Schülerkonten verfügbar." }, { status: 403 });
    }

    let assignmentContext = "Es wurde keine bestimmte Hausaufgabe ausgewählt.";
    if (parsed.data.homeworkId) {
      const { data: memberships, error: membershipError } = await supabase.from("class_memberships")
        .select("class_id").eq("student_id", user.id).eq("school_id", profile.school_id);
      if (membershipError) return NextResponse.json({ error: "Deine Klassenzuordnung konnte nicht geprüft werden." }, { status: 500 });
      const classIds = (memberships ?? []).map((row) => row.class_id);
      if (!classIds.length) return NextResponse.json({ error: "Dir ist noch keine Klasse zugeordnet." }, { status: 403 });

      const { data: homework, error } = await supabase.from("homework")
        .select("id,subject,learning_scope,description,due_at,class_id")
        .eq("id", parsed.data.homeworkId)
        .eq("school_id", profile.school_id)
        .in("class_id", classIds)
        .maybeSingle();
      if (error || !homework) return NextResponse.json({ error: "Diese Hausaufgabe gehört nicht zu deinen Klassen oder ist nicht verfügbar." }, { status: 404 });
      assignmentContext = [
        "Fach: " + homework.subject,
        "Unterrichtsthema der Lehrkraft: " + (homework.learning_scope || "Nicht angegeben"),
        "Aufgabenstellung: " + homework.description,
        "Abgabe: " + new Date(homework.due_at).toLocaleString("de-DE"),
      ].join("\n");
    }

    const attempt = parsed.data.attempt.trim();
    const prompt = `Du bist SchulWatch Lern-KI für Schüler in Deutschland. Erkläre altersgerecht, geduldig und in kleinen Schritten.
SICHERHEITS- UND DIDAKTIKREGELN:
- Verrate niemals sofort die fertige Lösung, Musterlösung oder das Endergebnis einer Hausaufgabe oder Klassenarbeitsübung.
- Frage zuerst, was der Schüler bereits versucht hat. Wenn kein eigener Rechenweg/Versuch vorliegt, gib nur einen kleinen Denkanstoß oder erkläre die nötige Grundregel, aber löse die konkrete Aufgabe nicht.
- Wenn ein Versuch vorliegt, prüfe genau diesen Schritt, sage freundlich was stimmt und was noch nicht stimmt, und gib höchstens den nächsten Hinweis. Lass den Schüler den nächsten Schritt selbst machen.
- Auch bei wiederholtem Nachfragen nicht einfach die Lösung ausgeben. Keine vollständigen Musterlösungen.
- Bei Recherchefragen nutze vertrauenswürdige, möglichst schulische oder offizielle Quellen; unterscheide gesicherte Fakten von Unsicherheit und nenne Quellenlinks.
- Erfinde keine Inhalte aus dem Unterricht. Nutze die Aufgaben- und Themenangaben der Lehrkraft als maßgeblichen Kontext.
- Gib keine privaten Informationen anderer Schüler oder Lehrkräfte preis.
AUFGABENKONTEXT:
${assignmentContext}
BISHERIGER VERSUCH DES SCHÜLERS:
${attempt || "Noch kein eigener Lösungsversuch angegeben."}
FRAGE:
${parsed.data.message}
Antworte auf Deutsch. Beginne bei fehlendem Versuch mit einer kurzen Ermutigung und genau einer konkreten Rückfrage nach dem ersten eigenen Schritt.`;

    const result = await runOpenAIResponse({ input: prompt, useWebSearch: true, maxOutputTokens: 900 });
    return NextResponse.json({ answer: result.text, citations: result.citations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Lern-KI ist gerade nicht verfügbar.";
    return NextResponse.json({ error: message }, { status: error instanceof AiConfigurationError ? 503 : 500 });
  }
}
