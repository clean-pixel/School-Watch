import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FocusTimer } from "@/components/focus-timer";
import { saveFocusSession } from "@/app/dashboard/student-actions";

export default async function FocusPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "student" || profile.registration_status !== "approved") redirect("/dashboard");
  const { data: sessions } = await supabase.from("focus_sessions").select("focus_minutes,completed_at").eq("student_id", user.id).gte("completed_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("completed_at", { ascending: false }).limit(50);
  const minutes = (sessions ?? []).reduce((total, session) => total + session.focus_minutes, 0);
  return <main className="container"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">Übersicht</Link></header><div className="eyebrow">SchulWatch Focus</div><h1 style={{ fontSize: "2.5rem" }}>Dein Fokusmodus</h1>{status && <div className="notice" role="status">{status === "saved" ? "Lerneinheit gespeichert." : "Speichern fehlgeschlagen. Prüfe die Datenbankmigration."}</div>}<FocusTimer saveAction={saveFocusSession}/><article className="card"><h2>Deine Lernzeit</h2><p>{minutes} Minuten in den letzten 7 Tagen · {sessions?.length ?? 0} gespeicherte Einheiten</p><p>Diese Übersicht ist nur für dich sichtbar. Es gibt keine Rangliste.</p></article></main>;
}
