import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse, type OpenAIInputMessage } from "@/lib/openai-responses";

const schema = z.object({
  chatId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  mode: z.enum(["chat", "worksheet", "lesson_plan", "test", "solutions", "parent_letter"]).default("chat"),
});

const modeInstructions: Record<z.infer<typeof schema>["mode"], string> = {
  chat: "Beantworte die Lehrkraftfrage fachlich fundiert, praktisch und verständlich.",
  worksheet: [
    "Erstelle ein druckfertiges Arbeitsblatt zum genannten Thema.",
    "Enthalten sein müssen: klarer Titel, Lernziel, kurze verständliche Arbeitsanweisung, abwechslungsreiche nummerierte Aufgaben und bei Bedarf eine Zusatzaufgabe.",
    "Passe Sprache und Schwierigkeit an den Jahrgang an. Nutze klare, kopierbare Formatierung.",
    "Trenne die Musterlösung zwingend mit exakt dieser alleinstehenden Zeile ab: [[MUSTERLÖSUNG_NUR_LEHRKRAFT]].",
    "Vor dem Marker steht ausschließlich das Arbeitsblatt für Schüler. Nach dem Marker stehen ausschließlich die Lösungen für die Lehrkraft.",
  ].join("\n"),
  lesson_plan: "Erstelle einen umsetzbaren Stundenentwurf mit Lernzielen, benötigtem Material, Zeitplan, Unterrichtsphasen, Lehrerimpulsen, Differenzierung und kurzer Lernzielkontrolle.",
  test: "Erstelle eine faire Lernzielkontrolle oder Klassenarbeit mit Aufgabenmix, Punkten und transparenter Punkteverteilung. Trenne die Lösungen mit der alleinstehenden Zeile [[MUSTERLÖSUNG_NUR_LEHRKRAFT]] ab.",
  solutions: "Erstelle einen nachvollziehbaren Erwartungshorizont bzw. Musterlösungen. Zeige Rechen- oder Denkwege und typische Fehler.",
  parent_letter: "Formuliere einen freundlichen, professionellen und klaren Elternbrief. Erfinde keine Termine, Namen oder Fakten. Setze fehlende Angaben als [bitte ergänzen] ein.",
};

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte gib eine gültige Nachricht ein." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Die Lehrer-KI ist nur für freigegebene Lehrkräfte verfügbar." }, { status: 403 });
    }

    const { data: chat, error: chatError } = await supabase.from("teacher_ai_chats")
      .select("id,school_id,class_id,teacher_id,subject,title")
      .eq("id", parsed.data.chatId).eq("teacher_id", user.id).eq("school_id", profile.school_id).maybeSingle();
    if (chatError || !chat) return NextResponse.json({ error: "Dieser Chat gehört nicht zu deinem Konto." }, { status: 404 });

    const [classResult, schoolResult, assignmentResult, historyResult] = await Promise.all([
      supabase.from("classes").select("name,grade").eq("id", chat.class_id).eq("school_id", chat.school_id).maybeSingle(),
      supabase.from("schools").select("name,school_type,state").eq("id", chat.school_id).maybeSingle(),
      supabase.from("teacher_assignments").select("id").eq("school_id", chat.school_id)
        .eq("class_id", chat.class_id).eq("teacher_id", user.id).eq("subject", chat.subject).maybeSingle(),
      supabase.from("teacher_ai_messages").select("role,content").eq("chat_id", chat.id)
        .eq("teacher_id", user.id).order("created_at", { ascending: false }).limit(14),
    ]);
    if (!assignmentResult.data || assignmentResult.error) {
      return NextResponse.json({ error: "Deine Fachzuordnung wurde nicht gefunden. Bitte wende dich an die Schulleitung." }, { status: 403 });
    }
    if (historyResult.error) return NextResponse.json({ error: "Der Chatverlauf konnte nicht geladen werden." }, { status: 500 });

    const className = classResult.data?.name ?? "deine Klasse";
    const grade = classResult.data?.grade ?? "nicht angegeben";
    const schoolName = schoolResult.data?.name ?? "deine Schule";
    const state = schoolResult.data?.state ?? "nicht angegeben";
    const instructions = [
      "Du bist die SchulWatch Lehrer-KI, ein professioneller Assistent für Lehrkräfte an Schulen in Deutschland.",
      "Antworte auf Deutsch, strukturiert, praxisnah und fachlich sorgfältig.",
      "Aktueller Kontext: Fach " + chat.subject + "; Klasse " + className + "; Jahrgang " + grade + "; Schule " + schoolName + "; Bundesland " + state + ".",
      modeInstructions[parsed.data.mode],
      "Erfinde keine Lehrplanvorgaben, Schulregeln, Schülerdaten oder Quellen. Wenn Bundesland, Lehrplan oder fachliche Voraussetzung unbekannt ist, kennzeichne das oder frage nach.",
      "Arbeitsblätter, Notenentscheidungen und Unterrichtsmaterial sind Entwürfe. Weise die Lehrkraft darauf hin, Inhalte vor Verwendung fachlich und altersgerecht zu prüfen.",
      "Verwende keine echten Schülernamen. Bitte nicht um Passwörter, Kontaktdaten, Gesundheitsdaten oder andere vertrauliche Informationen. Ersetze personenbezogene Angaben durch neutrale Platzhalter.",
      "Beachte eine inklusive, diskriminierungsfreie und altersgerechte Sprache. Erteile keine Diagnosen und triff keine automatisierten Entscheidungen über einzelne Schüler.",
    ].join("\n");

    const history = [...(historyResult.data ?? [])].reverse() as { role: "user" | "assistant"; content: string }[];
    const input: OpenAIInputMessage[] = [
      { role: "developer", content: instructions },
      ...history,
      { role: "user", content: parsed.data.message },
    ];
    const result = await runOpenAIResponse({ input, maxOutputTokens: parsed.data.mode === "worksheet" || parsed.data.mode === "test" ? 2600 : 2000 });

    const userSave = await supabase.from("teacher_ai_messages").insert({
      chat_id: chat.id, school_id: chat.school_id, teacher_id: user.id,
      role: "user", content: parsed.data.message,
    }).select("id").single();
    if (userSave.error || !userSave.data) return NextResponse.json({ error: "Die Nachricht konnte nicht gespeichert werden." }, { status: 500 });

    const assistantSave = await supabase.from("teacher_ai_messages").insert({
      chat_id: chat.id, school_id: chat.school_id, teacher_id: user.id,
      role: "assistant", content: result.text,
    });
    if (assistantSave.error) {
      await supabase.from("teacher_ai_messages").delete().eq("id", userSave.data.id);
      return NextResponse.json({ error: "Die KI-Antwort kam zurück, konnte aber nicht im Chat gespeichert werden." }, { status: 500 });
    }

    return NextResponse.json({ answer: result.text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Lehrer-KI ist gerade nicht verfügbar.";
    return NextResponse.json({ error: message }, { status: error instanceof AiConfigurationError ? 503 : 500 });
  }
}
