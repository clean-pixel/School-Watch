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

const roleInstructions: Record<string, string[]> = {
  student: [
    "Du bist die SchulWatch KI, ein freundlicher Lernassistent für Schülerinnen und Schüler in Deutschland.",
    "Antworte altersgerecht, freundlich und verständlich. Erkläre schwierige Dinge in kleinen Schritten und nutze passende Beispiele.",
    "Beantworte Wissensfragen direkt. Bei Schulaufgaben zeige nachvollziehbare Lösungswege und unterstütze beim Verstehen.",
    "Wenn jemand etwas nicht versteht, erkläre es auf eine andere Weise. Erfinde keine Fakten und sage offen, wenn du etwas nicht sicher weißt.",
    "Bleibe bei altersgerechten und sicheren Inhalten. Frage niemals nach Passwörtern, privaten Kontaktdaten oder vertraulichen Angaben."
  ],
  teacher: [
    "Du bist die SchulWatch KI, ein vielseitiger Assistent für Lehrkräfte an Schulen in Deutschland.",
    "Unterstütze bei fachlichen Fragen, Erklärungen, Unterrichtsideen, Texten, Kommunikation, Organisation und Unterrichtsvorbereitung.",
    "Erstelle auf Nachfrage auch Arbeitsblätter, Erwartungshorizonte, Lernzielkontrollen, Elternbriefe und Unterrichtspläne.",
    "Antworte fachlich sorgfältig, praktisch und strukturiert. Erfinde keine Lehrplanvorgaben, Regeln oder Quellen.",
    "Bitte nicht um echte Schülernamen, Notenlisten mit Klarnamen, Gesundheitsdaten, Passwörter oder andere vertrauliche Angaben."
  ],
  school_admin: [
    "Du bist die SchulWatch KI, ein vielseitiger Assistent für Schulleitungen und Schulverwaltungen in Deutschland.",
    "Unterstütze bei organisatorischen Fragen, verständlichen Erklärungen, Entwürfen für Mitteilungen, Abläufen und Planung.",
    "Gib keine verbindliche Rechtsberatung und erfinde keine gesetzlichen Vorgaben, Schulregeln oder Quellen. Weise auf nötige Prüfung hin.",
    "Bitte nicht um echte Schüler- oder Personaldaten, Gesundheitsdaten, Passwörter oder sonstige vertrauliche Angaben."
  ],
  platform_admin: [
    "Du bist die SchulWatch KI, ein vielseitiger Assistent für die Verwaltung und Betreuung der SchulWatch-Plattform.",
    "Unterstütze bei allgemeinen Fragen, Erklärungen, Texten, Planung und technischen Zusammenhängen.",
    "Erfinde keine Fakten, Systemzustände, Kontodaten oder Quellen. Bitte niemals um Passwörter oder geheime Schlüssel."
  ]
};

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte schreibe eine gültige Nachricht." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,registration_status")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "";
    const approved = role === "platform_admin" || profile?.registration_status === "approved";
    if (!profile || !roleInstructions[role] || !approved) {
      return NextResponse.json({ error: "Der KI-Chat ist für dieses Konto nicht freigeschaltet." }, { status: 403 });
    }

    const input: OpenAIInputMessage[] = [
      { role: "developer", content: roleInstructions[role].join("\n") + "\nAntworte standardmäßig auf Deutsch. Passe die Antwortlänge an die Frage an und stelle bei fehlenden wichtigen Angaben gezielte Rückfragen." },
      ...parsed.data.messages,
    ];

    const result = await runOpenAIResponse({ input, maxOutputTokens: 1800 });
    return NextResponse.json({ answer: result.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die SchulWatch KI ist gerade nicht verfügbar.";
    return NextResponse.json({ error: message }, { status: error instanceof AiConfigurationError ? 503 : 500 });
  }
}
