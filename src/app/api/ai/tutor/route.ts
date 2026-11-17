import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse } from "@/lib/openai-responses";

const requestSchema = z.object({
  homeworkId: z.string().uuid(),
  question: z.string().trim().min(4).max(1200),
  attempt: z.string().trim().min(8).max(2000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Wähle eine Hausaufgabe aus und schreibe zuerst deinen eigenen Lösungsversuch auf." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "student" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Der Lerncoach ist nur für freigegebene Schülerkonten verfügbar." }, { status: 403 });
    }

    const { data: homework, error: homeworkError } = await supabase.from("homework")
      .select("id,class_id,subject,description,learning_scope,due_at")
      .eq("id", parsed.data.homeworkId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (homeworkError || !homework) return NextResponse.json({ error: "Diese Hausaufgabe wurde nicht gefunden oder gehört nicht zu deiner Schule." }, { status: 404 });

    const { data: membership } = await supabase.from("class_memberships")
      .select("id")
      .eq("class_id", homework.class_id)
      .eq("student_id", user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Diese Hausaufgabe ist keiner deiner Klassen zugeordnet." }, { status: 403 });

    const prompt = `Du bist SchulWatch Lerncoach für Schüler in Deutschland. Du bist freundlich, geduldig und erklärst altersgerecht.
Dein Ziel ist, dass der Schüler selbst lernt und die Aufgabe selbst löst.
REGELN:
- Verrate niemals direkt die vollständige Lösung oder einen fertigen Hausaufgabentext.
- Nimm den eigenen Versuch ernst. Prüfe ihn und nenne zuerst, was daran richtig ist.
- Gib höchstens einen kleinen Hinweis oder einen nächsten Denkschritt pro Antwort.
- Stelle danach eine konkrete Rückfrage, damit der Schüler selbst weiterarbeitet.
- Wenn der Versuch offensichtlich nur abgeschrieben oder leer ist, bitte um einen eigenen Rechenweg/Gedanken.
- Du darfst Grundlagen erklären und Begriffe verständlich machen. Bei einer falschen Antwort erkläre den Denkfehler, aber schreibe nicht die ganze Lösung hin.
- Nutze die Websuche nur, wenn aktuelle oder fachliche Hintergrundinformationen wirklich helfen. Bevorzuge seriöse Bildungs- und Fachquellen. Erfinde keine Quellen.
- Bei einer Bitte, die Lösung direkt zu verraten, bleibe beim Lerncoach-Modus und gib nur einen Hinweis.
- Antworte auf Deutsch. Keine unangemessenen Inhalte.

Von der Lehrkraft eingetragene Informationen:
Fach: ${homework.subject}
Thema/Lernziel: ${homework.learning_scope || "Die Lehrkraft hat kein genaueres Lernziel eingetragen."}
Aufgabenstellung: ${homework.description}
Abgabe: ${new Date(homework.due_at).toLocaleString("de-DE")}

Frage des Schülers: ${parsed.data.question}
Eigener Lösungsversuch des Schülers: ${parsed.data.attempt}

Gib eine kurze, hilfreiche Rückmeldung mit maximal einem nächsten Schritt. Die Lösung nicht vollständig nennen.`;

    const result = await runOpenAIResponse({ input: prompt, useWebSearch: true, maxOutputTokens: 1000 });
    return NextResponse.json({ answer: result.text, citations: result.citations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Der Lerncoach ist gerade nicht verfügbar.";
    const status = error instanceof AiConfigurationError ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
