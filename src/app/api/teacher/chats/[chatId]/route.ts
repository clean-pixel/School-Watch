import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ chatId: string }> }) {
  try {
    const { chatId } = await context.params;
    if (!idSchema.safeParse(chatId).success) return NextResponse.json({ error: "Ungültiger Chat." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles")
      .select("role,school_id,registration_status")
      .eq("id", user.id).maybeSingle();
    if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
      return NextResponse.json({ error: "Keine Berechtigung für Lehrer-Chats." }, { status: 403 });
    }

    const { data: chat, error: chatError } = await supabase.from("teacher_ai_chats")
      .select("id,title,subject,class_id,created_at")
      .eq("id", chatId).eq("teacher_id", user.id).eq("school_id", profile.school_id).maybeSingle();
    if (chatError || !chat) return NextResponse.json({ error: "Chat nicht gefunden." }, { status: 404 });

    const { data: messages, error } = await supabase.from("teacher_ai_messages")
      .select("id,role,content,created_at")
      .eq("chat_id", chatId).eq("teacher_id", user.id)
      .order("created_at", { ascending: true }).limit(60);
    if (error) return NextResponse.json({ error: "Nachrichten konnten nicht geladen werden." }, { status: 500 });

    return NextResponse.json({ chat, messages: messages ?? [] });
  } catch {
    return NextResponse.json({ error: "Der Chat konnte nicht geladen werden." }, { status: 500 });
  }
}
