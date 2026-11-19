import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const allowedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/m4a",
]);

function safeMessage(value: unknown) {
  return typeof value === "string"
    ? value.replace(/sk-[A-Za-z0-9_-]{6,}/g, "[verborgen]").slice(0, 240)
    : "";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich zuerst an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,registration_status")
      .eq("id", user.id)
      .maybeSingle();

    const allowedRoles = ["student", "teacher", "school_admin", "platform_admin"];
    if (!profile || !allowedRoles.includes(profile.role) ||
        (profile.role !== "platform_admin" && profile.registration_status !== "approved")) {
      return NextResponse.json({ error: "Die Spracheingabe ist für dieses Konto nicht freigeschaltet." }, { status: 403 });
    }

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Es wurde keine Sprachaufnahme gefunden." }, { status: 400 });
    }
    if (audio.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Die Aufnahme ist zu groß. Bitte sprich höchstens 60 Sekunden." }, { status: 413 });
    }
    if (!allowedAudioTypes.has(audio.type.toLowerCase())) {
      return NextResponse.json({ error: "Dieses Audioformat wird nicht unterstützt. Bitte nutze die Mikrofonaufnahme in SchulWatch." }, { status: 415 });
    }

    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim().replace(/^Bearer\s+/i, "");
    if (!apiKey) {
      return NextResponse.json({ error: "Die KI ist noch nicht verbunden. Hinterlege OPENAI_API_KEY in Vercel." }, { status: 503 });
    }

    const extension = audio.type.includes("webm") ? "webm"
      : audio.type.includes("ogg") ? "ogg"
      : audio.type.includes("mp4") || audio.type.includes("m4a") ? "m4a"
      : audio.type.includes("mpeg") || audio.type.includes("mpga") ? "mp3"
      : audio.type.includes("flac") ? "flac" : "wav";

    const upstream = new FormData();
    upstream.append("model", "gpt-transcribe");
    upstream.append("language", "de");
    upstream.append("file", new Blob([await audio.arrayBuffer()], { type: audio.type }), "schulwatch-aufnahme." + extension);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: upstream,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
    if (!response.ok) {
      const detail = safeMessage(payload.error?.message);
      console.error("[SchulWatch transcription] OpenAI request failed", {
        status: response.status,
        detail: detail || null,
        requestId: response.headers.get("x-request-id"),
      });
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: "Die KI-Spracherkennung ist nicht richtig konfiguriert. Prüfe den OpenAI-API-Schlüssel." }, { status: 503 });
      }
      return NextResponse.json({ error: "Die Sprachaufnahme konnte gerade nicht verarbeitet werden. Bitte versuche es erneut." }, { status: response.status === 429 ? 429 : 502 });
    }

    const transcript = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!transcript) return NextResponse.json({ error: "Ich konnte in der Aufnahme keine Sprache erkennen." }, { status: 422 });
    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("[SchulWatch transcription] Request failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Die Spracheingabe ist gerade nicht verfügbar." }, { status: 500 });
  }
}
