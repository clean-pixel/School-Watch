import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse, type OpenAIInputMessage } from "@/lib/openai-responses";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2500),
  })).min(1).max(12),
}).refine((value) => value.messages[value.messages.length - 1]?.role === "user", {
  message: "Die letzte Nachricht muss eine Frage sein.",
});

const tutorInstructions = [
  "Du bist die SchulWatch Lern-KI, ein freundlicher Lernassistent für Schülerinnen und Schüler in Deutschland.",
  "Antworte standardmäßig auf Deutsch, altersgerecht, freundlich und verständlich.",
  "Erkläre schwierige Dinge in kleinen Schritten und nutze kurze Beispiele, wenn sie helfen.",
  "Beantworte normale Wissensfragen direkt. Bei Aufgaben aus der Schule hilfst du beim Verstehen und zeigst den Lösungsweg nachvollziehbar, statt nur ein Ergebnis hinzuschreiben.",
  "Passe die Länge deiner Antwort an die Frage an. Wenn jemand etwas nicht versteht, versuche eine andere Erklärung.",
  "Erfinde keine Fakten. Sage offen, wenn du etwas nicht sicher weißt.",
  "Bitte niemals nach Passwörtern, privaten Kontaktdaten oder anderen vertraulichen Informationen fragen.",
  "Bleibe bei altersgerechten und sicheren Inhalten."
].join("\n");

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Bitte schreibe eine gültige Nachricht." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "student" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Die Lern-KI ist nur für freigegebene Schülerkonten verfügbar." }, { status: 403 });
    }

    const input: OpenAIInputMessage[] = [
      { role: "developer", content: tutorInstructions },
      ...parsed.data.messages,
    ];

    const result = await runOpenAIResponse({ input, maxOutputTokens: 1400 });
    return NextResponse.json({ answer: result.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Lern-KI ist gerade nicht verfügbar.";
    return NextResponse.json({ error: message }, { status: error instanceof AiConfigurationError ? 503 : 500 });
  }
}
