import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const { data, error } = await supabase.from("toilet_requests").select("id,status,created_at,student_id,teacher_id").order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: "Anfragen konnten nicht geladen werden." }, { status: 500 });
  return NextResponse.json({ requests: data });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Ungültige Anfragequelle." }, { status: 403 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,registration_status,school_id").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "student" || profile.registration_status !== "approved" || !profile.school_id) return NextResponse.json({ error: "Diese Funktion ist für dein Konto nicht freigeschaltet." }, { status: 403 });
  const { data: existing } = await supabase.from("toilet_requests").select("id,status,created_at").eq("student_id", user.id).eq("status", "pending").maybeSingle();
  if (existing) return NextResponse.json({ request: existing });
  const { data: id, error } = await supabase.rpc("create_toilet_request");
  if (error || !id) return NextResponse.json({ error: "Anfrage konnte nicht gesendet werden. Prüfe, ob dir eine Klasse und zuständige Lehrkraft zugewiesen sind." }, { status: 400 });
  const { data: created } = await supabase.from("toilet_requests").select("id,status,created_at").eq("id", id).single();
  return NextResponse.json({ request: created }, { status: 201 });
}
