import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse } from "@/lib/openai-responses";

const cardContentSchema = z.object({
  question: z.string().trim().min(3).max(1200),
  answer: z.string().trim().min(2).max(2400),
});

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    subject: z.string().trim().min(1).max(80),
    notes: z.string().trim().min(20).max(6000),
  }),
  z.object({
    action: z.literal("save_generated"),
    subject: z.string().trim().min(1).max(80),
    cards: z.array(cardContentSchema).min(1).max(8),
  }),
  z.object({
    action: z.literal("create"),
    subject: z.string().trim().min(1).max(80),
    question: z.string().trim().min(3).max(1200),
    answer: z.string().trim().min(2).max(2400),
  }),
  z.object({
    action: z.literal("review"),
    id: z.string().uuid(),
    grade: z.enum(["again", "hard", "good", "easy"]),
  }),
]);

async function getStudent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 }) };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,school_id,registration_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.role !== "student" ||
      profile.registration_status !== "approved" || !profile.school_id) {
    return { response: NextResponse.json({ error: "LernLoop ist nur für freigegebene Schülerkonten verfügbar." }, { status: 403 }) };
  }

  return { supabase, user, response: null };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bitte prüfe deine Eingaben." }, { status: 400 });
    }

    const actor = await getStudent();
    if (actor.response) return actor.response;
    const { supabase, user } = actor;

    if (parsed.data.action === "generate") {
      const { subject, notes } = parsed.data;
      const prompt = [
        "Du bist LernLoop, ein sorgfältiger Lernkarten-Assistent für Schülerinnen und Schüler in Deutschland.",
        "Erstelle aus den Notizen 3 bis 8 kurze, hochwertige Karteikarten.",
        "Verwende ausschließlich Informationen aus den Notizen. Erfinde keine Fakten und ergänze kein Wissen, das nicht in den Notizen steht.",
        "Jede Frage soll genau einen Lernpunkt abfragen. Die Antwort soll verständlich, korrekt und möglichst knapp sein.",
        "Schreibe altersgerecht auf Deutsch. Keine Fangfragen, keine unnötig komplizierte Sprache.",
        "Gib ausschließlich ein JSON-Objekt mit dem Feld cards zurück. Jedes Element enthält genau question und answer.",
        "",
        "Fach: " + subject,
        "Notizen:",
        notes,
      ].join("\n");

      const result = await runOpenAIResponse({ input: prompt, maxOutputTokens: 2000, jsonMode: true });
      let raw: unknown;
      try {
        raw = JSON.parse(result.text);
      } catch {
        return NextResponse.json({ error: "Die KI-Karten konnten nicht gelesen werden. Bitte versuche es erneut." }, { status: 502 });
      }
      const generated = z.object({ cards: z.array(cardContentSchema).min(3).max(8) }).safeParse(raw);
      if (!generated.success) {
        return NextResponse.json({ error: "Die KI hat keine gültigen Lernkarten erstellt. Bitte formuliere deine Notizen etwas genauer." }, { status: 502 });
      }
      return NextResponse.json({ cards: generated.data.cards });
    }

    if (parsed.data.action === "create") {
      const { subject, question, answer } = parsed.data;
      const { data: card, error } = await supabase
        .from("student_flashcards")
        .insert({ student_id: user.id, subject, question, answer })
        .select("id,subject,question,answer,due_at,interval_days,repetitions")
        .single();
      if (error || !card) return NextResponse.json({ error: "Die Lernkarte konnte nicht gespeichert werden." }, { status: 500 });
      return NextResponse.json({ card }, { status: 201 });
    }

    if (parsed.data.action === "save_generated") {
      const { subject, cards } = parsed.data;
      const { data: saved, error } = await supabase
        .from("student_flashcards")
        .insert(cards.map((card) => ({ student_id: user.id, subject, question: card.question, answer: card.answer })))
        .select("id,subject,question,answer,due_at,interval_days,repetitions");
      if (error || !saved) return NextResponse.json({ error: "Die Lernkarten konnten nicht gespeichert werden." }, { status: 500 });
      return NextResponse.json({ cards: saved }, { status: 201 });
    }

    const { id, grade } = parsed.data;
    const { data: current, error: lookupError } = await supabase
      .from("student_flashcards")
      .select("id,interval_days,repetitions")
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (lookupError || !current) {
      return NextResponse.json({ error: "Diese Lernkarte wurde nicht gefunden." }, { status: 404 });
    }

    const now = new Date();
    let intervalDays = current.interval_days;
    let repetitions = current.repetitions + 1;
    let dueAt: Date;

    if (grade === "again") {
      intervalDays = 0;
      repetitions = 0;
      dueAt = new Date(now.getTime() + 10 * 60 * 1000);
    } else if (grade === "hard") {
      intervalDays = Math.max(1, Math.ceil((current.interval_days || 1) * 1.3));
      dueAt = addDays(now, intervalDays);
    } else if (grade === "good") {
      intervalDays = current.repetitions === 0 ? 1
        : current.repetitions === 1 ? 3
        : Math.min(365, Math.max(3, Math.round((current.interval_days || 2) * 2)));
      dueAt = addDays(now, intervalDays);
    } else {
      intervalDays = current.repetitions === 0 ? 3
        : Math.min(365, Math.max(4, Math.round((current.interval_days || 3) * 2.5)));
      dueAt = addDays(now, intervalDays);
    }

    const { data: updated, error: updateError } = await supabase
      .from("student_flashcards")
      .update({
        interval_days: intervalDays,
        repetitions,
        due_at: dueAt.toISOString(),
        last_reviewed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", id)
      .eq("student_id", user.id)
      .select("id,subject,question,answer,due_at,interval_days,repetitions")
      .single();

    if (updateError || !updated) return NextResponse.json({ error: "Der Lernfortschritt konnte nicht gespeichert werden." }, { status: 500 });
    return NextResponse.json({ card: updated });
  } catch (error) {
    const message = error instanceof AiConfigurationError
      ? error.message
      : error instanceof Error ? error.message : "LernLoop ist gerade nicht verfügbar.";
    return NextResponse.json({ error: message }, { status: error instanceof AiConfigurationError ? 503 : 500 });
  }
}
