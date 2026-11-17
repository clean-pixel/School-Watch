import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AiConfigurationError, runOpenAIResponse } from "@/lib/openai-responses";

const requestSchema = z.object({
  name: z.string().trim().min(3).max(160),
  state: z.string().trim().min(3).max(80),
  city: z.string().trim().min(2).max(120),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Bitte Schulname, Bundesland und Ort eingeben." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "school_admin" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Die Schulrecherche ist nur für freigegebene Schulleitungen verfügbar." }, { status: 403 });
    }
    const { data: school } = await supabase.from("schools").select("name,city,state").eq("id", profile.school_id).maybeSingle();
    if (!school) return NextResponse.json({ error: "Schulprofil nicht gefunden." }, { status: 404 });

    const prompt = `Recherchiere diese konkrete Schule im Internet: Name: ${parsed.data.name}; Ort: ${parsed.data.city}; Bundesland: ${parsed.data.state}.
Nutze Websuche und bevorzuge offizielle Schul-Webseiten, offizielle Schulverzeichnisse und das zuständige Kultus-/Bildungsministerium.
Erfinde keine Angaben. Verwechsle keine gleichnamigen Schulen. Wenn du die Schule nicht eindeutig verifizieren kannst, setze found=false und gib keine Klassen-/Fächervorschläge aus.
Gib ausschließlich ein valides JSON-Objekt in diesem Format zurück:
{
  "found": true,
  "officialName": "offizieller Name",
  "schoolType": "Schulart",
  "address": "offizielle Anschrift oder leer",
  "website": "https://...",
  "confidence": "hoch|mittel|niedrig",
  "summary": "kurze Zusammenfassung mit Hinweis auf Unsicherheiten",
  "sources": ["https://offizielle-quelle-1", "https://offizielle-quelle-2"],
  "classes": [
    {"name": "5a", "grade": "5", "subjects": ["Deutsch", "Mathematik"]}
  ]
}
WICHTIG: Klassen und Fächer nur vorschlagen, wenn sie auf offiziellen Quellen für exakt diese Schule oder ihren offiziellen Bildungsgang nachvollziehbar sind. Wenn nur der allgemeine Landeslehrplan auffindbar ist, erkläre das in summary und setze classes auf []. Niemals so tun, als seien alle tatsächlichen Klassen gefunden worden. Maximal 20 Klassenvorschläge, maximal 20 Fächer pro Klasse.
Antwortsprache Deutsch.`;

    const result = await runOpenAIResponse({ input: prompt, useWebSearch: true, maxOutputTokens: 2400 });
    const jsonStart = result.text.indexOf("{");
    const jsonEnd = result.text.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      return NextResponse.json({ error: "Die KI-Recherche lieferte kein auswertbares Ergebnis. Bitte versuche es erneut.", citations: result.citations }, { status: 502 });
    }
    let research: unknown;
    try { research = JSON.parse(result.text.slice(jsonStart, jsonEnd + 1)); }
    catch { return NextResponse.json({ error: "Die KI-Recherche lieferte kein gültiges Ergebnis. Bitte versuche es erneut.", citations: result.citations }, { status: 502 }); }

    const resultSchema = z.object({
      found: z.boolean(),
      officialName: z.string().max(200).optional(),
      schoolType: z.string().max(120).optional(),
      address: z.string().max(250).optional(),
      website: z.string().max(500).optional(),
      confidence: z.enum(["hoch", "mittel", "niedrig"]).optional(),
      summary: z.string().max(3000).optional(),
      sources: z.array(z.string().url()).max(12).default([]),
      classes: z.array(z.object({
        name: z.string().trim().min(1).max(80),
        grade: z.string().max(40).optional(),
        subjects: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
      })).max(20).default([]),
    });
    const validated = resultSchema.safeParse(research);
    if (!validated.success) return NextResponse.json({ error: "Die Recherche konnte nicht validiert werden.", citations: result.citations }, { status: 502 });
    return NextResponse.json({
      research: validated.data,
      citations: result.citations,
      checkedSchool: { name: school.name, city: school.city, state: school.state },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Schulrecherche ist gerade nicht verfügbar.";
    const status = error instanceof AiConfigurationError ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
