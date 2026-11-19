import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse, type OpenAIInputMessage } from "@/lib/openai-responses";

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

const fileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  format: z.enum(["md", "txt", "csv", "html", "json"]),
  content: z.string().min(1).max(30000),
});
const outputSchema = z.object({
  answer: z.string().trim().min(1).max(18000),
  files: z.array(fileSchema).max(4).default([]),
  actions: z.array(actionSchema).max(20).default([]),
});
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().max(20000),
  images: z.array(z.string().regex(/^data:image\\/(?:png|jpeg|webp);base64,/).max(5600000)).max(2).optional(),
}).superRefine((message, context) => {
  if (!message.content && !(message.images?.length)) {
    context.addIssue({ code: "custom", message: "Schreibe eine Nachricht oder füge ein Bild hinzu." });
  }
});
const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(12),
}).superRefine((value, context) => {
  value.messages.forEach((message, index) => {
    if (message.role === "user" && message.content.length > 5000) {
      context.addIssue({ code: "custom", path: ["messages", index, "content"], message: "Eine eigene Nachricht darf höchstens 5.000 Zeichen lang sein." });
    }
    if (message.role === "assistant" && message.images?.length) {
      context.addIssue({ code: "custom", path: ["messages", index, "images"], message: "Bilder können nur in eigenen Nachrichten gesendet werden." });
    }
  });
  if (value.messages[value.messages.length - 1]?.role !== "user") {
    context.addIssue({ code: "custom", path: ["messages"], message: "Die letzte Nachricht muss von dir stammen." });
  }
});

const roleInstructions: Record<string, string[]> = {
  student: [
    "Du bist SchulWatch KI, ein freundlicher Lernassistent für Schülerinnen und Schüler in Deutschland.",
    "Antworte altersgerecht, verständlich und freundlich. Erkläre schwierige Dinge in kleinen Schritten, mit Beispielen.",
    "WICHTIGE LERNREGEL: Bei einer konkreten Rechen-, Haus- oder Übungsaufgabe darfst du NICHT sofort das Endergebnis, eine vollständige Musterlösung oder alle ausgefüllten Antworten verraten. Fordere zuerst einen eigenen Versuch an: Frage zum Beispiel „Was hast du bisher gerechnet?“ oder bitte um den ersten Rechenschritt. Gib höchstens einen kleinen, hilfreichen Hinweis und stelle genau eine passende Rückfrage. Wenn die Person sagt, sie weiß nicht weiter, zerlege nur den ALLERERSTEN Schritt und lass sie diesen selbst ausführen. Auch bei „Gib mir einfach die Lösung“ sollst du zunächst beim eigenen Versuch helfen. Sobald die Person einen eigenen Versuch oder Rechenschritt geschickt hat, prüfe genau diesen, erkläre freundlich Fehler und gib den nächsten Schritt. Eine vollständige Lösung gibt es erst, nachdem ein eigener Versuch vorliegt und die Person danach weiterhin eine vollständige Erklärung braucht. Bei normalen Wissensfragen ohne Übungscharakter beantworte die Frage weiterhin direkt.",
    "Bei Mathematik schreibe verständlich und sauber: Nutze echte Hochzahlen wie 12⁴ oder korrekt markierte Formeln, erkläre kurz, was eine Potenz bedeutet, und trenne jeden Rechenschritt in eine eigene Zeile. Verwende im Deutschen den Punkt als Tausendertrennzeichen und das Komma als Dezimalzeichen. Gib nie eine bloße Zahlenkette ohne Erklärung aus.",
    "Du kannst auch hochgeladene Fotos von Arbeitsblättern, Buchseiten und Aufgaben analysieren. Lies den sichtbaren Inhalt sorgfältig, beschreibe unleserliche Stellen ehrlich und rate keine fehlenden Aufgaben ab.",
    "Du kannst auch Dateien als Lernzettel, Zusammenfassung, Karteikarten, Tabellen oder Übungsblätter erstellen. Gib dann eine passende Datei in files zurück.",
    "Schüler dürfen keine Schulverwaltung, Klassen, Stundenpläne, Lehrerzuordnungen oder andere Schul-Datenbankeinträge verändern. Erstelle dafür keine actions.",
    "Bitte niemals um Passwörter, private Kontaktdaten oder vertrauliche Angaben. Erfinde keine Fakten und kennzeichne Unsicherheit."
  ],
  teacher: [
    "Du bist SchulWatch KI, ein vielseitiger Assistent für Lehrkräfte an Schulen in Deutschland.",
    "Hilf bei Unterricht, Klassenorganisation, Stundenplanung, Aufgaben, Elternkommunikation und fachlichen Fragen.",
    "Erstelle herunterladbare Dateien wie Arbeitsblätter, Lernzielkontrollen, Lösungen, Unterrichtspläne, Tabellen und CSV-Dateien, wenn es passt.",
    "Du darfst Stundenplaneinträge nur für Klassen und Fächer vorschlagen, denen die angemeldete Lehrkraft zugeordnet ist. Du darfst keine Klassen anlegen oder fremde Lehrkräfte zuordnen.",
    "Für Datenbankänderungen erstelle nur Vorschläge in actions. Die Lehrkraft muss sie anschließend ausdrücklich bestätigen. Erfinde keine Klassen, Fachzuordnungen oder Lehrkraft-Zuordnungen.",
    "Verwende keine echten Schülernamen oder vertraulichen Schülerdaten. Prüfe Zeitüberschneidungen nicht nur sprachlich: Die Anwendung prüft sie beim Speichern."
  ],
  school_admin: [
    "Du bist SchulWatch KI, ein Verwaltungs- und Organisationsassistent für Schulleitungen in Deutschland.",
    "Du darfst auf Basis des mitgelieferten Schulkontexts Klassen, Fächer, Lehrkraft-Zuordnungen und Stundenpläne vorbereiten.",
    "Du kannst Dateien wie CSV-Listen, Stundenplanentwürfe, Schulbriefe, Tabellen und Dokumente erzeugen. Gib Dateien in files zurück, mit sinnvoller Endung im Namen.",
    "Für Datenbankänderungen gib ausschließlich konkrete Vorschläge in actions zurück. Nichts wird gespeichert, bevor die Schulleitung auf 'Änderungen übernehmen' klickt.",
    "Verwende für Klassen und Lehrkräfte exakt die Namen und IDs aus dem Schulkontext. Erfinde niemals Mitarbeitende oder Zuordnungen. Bei mehrdeutiger Lehrkraft-Zuordnung frage nach statt zu raten.",
    "Die Anwendung prüft Berechtigungen, bestehende Daten und Stundenplanüberschneidungen erneut, bevor sie speichert.",
    "Bitte nicht um echte Schülernamen, Notenlisten mit Klarnamen, Gesundheitsdaten, Passwörter oder vertrauliche Angaben."
  ],
  platform_admin: [
    "Du bist SchulWatch KI, ein Assistent für allgemeine Fragen, technische Erklärungen und die Betreuung der Plattform.",
    "Erstelle bei Bedarf herunterladbare Dateien und Entwürfe. Ändere keine Schul-Datenbankeinträge aus diesem Chat.",
    "Erfinde keine Fakten, Systemzustände, Kontodaten oder Quellen. Bitte niemals um Passwörter oder geheime Schlüssel."
  ]
};

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message;
      return NextResponse.json({ error: issue || "Bitte schreibe eine gültige Nachricht." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "";
    const approved = role === "platform_admin" || profile?.registration_status === "approved";
    if (!profile || !roleInstructions[role] || !approved) {
      return NextResponse.json({ error: "Der KI-Chat ist für dieses Konto nicht freigeschaltet." }, { status: 403 });
    }

    let schoolContext = "Kein Schulprofil mit dieser Sitzung verbunden.";
    if (profile.school_id) {
      const [schoolResult, classesResult, subjectsResult, assignmentsResult, teachersResult] = await Promise.all([
        supabase.from("schools").select("name,city,state,day_start_time,day_end_time").eq("id", profile.school_id).maybeSingle(),
        supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).order("name").limit(100),
        supabase.from("class_subjects").select("class_id,subject,weekly_periods_a,weekly_periods_b").eq("school_id", profile.school_id).limit(500),
        (() => {
          let query = supabase.from("teacher_assignments").select("class_id,teacher_id,subject").eq("school_id", profile.school_id);
          if (role === "teacher") query = query.eq("teacher_id", user.id);
          return query.limit(500);
        })(),
        (() => {
          let query = supabase.from("teachers").select("id,name,subjects").eq("school_id", profile.school_id);
          if (role === "teacher") query = query.eq("id", user.id);
          return query.limit(100);
        })(),
      ]);
      const classes = classesResult.data ?? [];
      const classNames = new Map(classes.map((item) => [item.id, item.name]));
      const teachers = (teachersResult.data ?? []).map((teacher) => ({
        id: teacher.id,
        name: teacher.name,
        subjects: teacher.subjects ?? [],
      }));
      const assignments = (assignmentsResult.data ?? []).map((item) => ({
        className: classNames.get(item.class_id) ?? "Unbekannte Klasse",
        subject: item.subject,
        teacher: teachers.find((teacher) => teacher.id === item.teacher_id)?.name ?? "zugeordnete Lehrkraft",
        teacherId: item.teacher_id,
      }));
      schoolContext = JSON.stringify({
        school: schoolResult.data ?? null,
        classes,
        subjects: (subjectsResult.data ?? []).map((item) => ({
          className: classNames.get(item.class_id) ?? "Unbekannte Klasse",
          subject: item.subject,
          weeklyPeriodsA: item.weekly_periods_a,
          weeklyPeriodsB: item.weekly_periods_b,
        })),
        teachers,
        assignments,
      });
    }

    const systemText = [
      ...roleInstructions[role],
      "Schulkontext (Datenbankauszug; nur für diesen Benutzer und dessen school_id): " + schoolContext,
      "Antworte standardmäßig auf Deutsch. Bitte liefere IMMER ein valides JSON-Objekt mit exakt den Feldern answer, files und actions.",
      "JSON-Format: {\"answer\":\"Antworttext\",\"files\":[{\"name\":\"Dateiname mit Endung\",\"format\":\"md|txt|csv|html|json\",\"content\":\"vollständiger Dateiinhalt\"}],\"actions\":[]}.",
      "Wenn keine Datei gebraucht wird, files=[]. Wenn keine bestätigungspflichtige Änderung sinnvoll oder möglich ist, actions=[].",
      "Erlaubte actions: create_class {type,name,grade,subjects}; add_subjects {type,className,subjects}; assign_teacher {type,className,subject,teacherId}; create_timetable {type,className,entries:[{weekday,startsAt,endsAt,subject,room,weekType}]}.",
      "weekday: 1=Montag, 2=Dienstag, 3=Mittwoch, 4=Donnerstag, 5=Freitag. Zeiten im 24-Stunden-Format HH:MM. weekType ist both, A oder B.",
      "Erstelle keine actions für fehlende Angaben. Frage im answer gezielt nach, wenn Schule, Klasse, Lehrkraft, Fach oder Uhrzeiten fehlen. Nutze nur Daten und Rechte aus dem Schulkontext.",
      "Dateien sind direkt herunterladbar. Nutze CSV für Tabellen/Listen und Markdown oder HTML für gut formatierte Dokumente. Dateinamen ohne Pfade."
    ].join("\n");

    const input: OpenAIInputMessage[] = [
      { role: "developer", content: systemText },
      ...parsed.data.messages.map((message) => ({
        role: message.role,
        content: message.images?.length
          ? [
              ...(message.content ? [{ type: "input_text" as const, text: message.content }] : []),
              ...message.images.map((image_url) => ({ type: "input_image" as const, image_url, detail: "auto" as const })),
            ]
          : message.content,
      })),
    ];
    const result = await runOpenAIResponse({ input, maxOutputTokens: 3400, jsonMode: true });

    let rawOutput: unknown;
    try {
      rawOutput = JSON.parse(result.text);
    } catch {
      console.error("[SchulWatch AI] Model returned invalid JSON.");
      return NextResponse.json({ error: "Die KI-Antwort konnte nicht gelesen werden. Bitte versuche es noch einmal." }, { status: 502 });
    }
    const output = outputSchema.safeParse(rawOutput);
    if (!output.success) {
      console.error("[SchulWatch AI] Structured output failed validation:", output.error.issues.slice(0, 4));
      return NextResponse.json({ error: "Die KI hat ein unvollständiges Ergebnis erzeugt. Bitte formuliere die Anfrage etwas genauer." }, { status: 502 });
    }

    const canProposeChanges = role === "teacher" || role === "school_admin";
    return NextResponse.json({
      answer: output.data.answer,
      files: output.data.files,
      actions: canProposeChanges ? output.data.actions : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die SchulWatch KI ist gerade nicht verfügbar.";
    return NextResponse.json({ error: message }, { status: error instanceof AiConfigurationError ? 503 : 500 });
  }
}
