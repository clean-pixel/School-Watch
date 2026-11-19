import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LernLoop, type LernLoopCard } from "./lernloop-client";

export default async function LernLoopPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,school_id,registration_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "student" ||
      profile.registration_status !== "approved" || !profile.school_id) {
    redirect("/dashboard");
  }

  const { data, error } = await supabase
    .from("student_flashcards")
    .select("id,subject,question,answer,due_at,interval_days,repetitions")
    .eq("student_id", user.id)
    .order("due_at", { ascending: true })
    .limit(500);

  return (
    <main className="container lernloop-page">
      <header className="topbar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
        <Link href="/dashboard">← Übersicht</Link>
      </header>
      <div className="eyebrow">Dein persönlicher Lernkreislauf</div>
      <h1 style={{ fontSize: "2.7rem" }}>LernLoop</h1>
      <p className="lernloop-intro">Aus deinen Notizen werden Lernkarten. LernLoop merkt sich, was schon sitzt, und plant schwierige Karten früher wieder ein – ganz ohne Ranglisten oder Leistungsdruck.</p>
      {error
        ? <div className="notice" role="alert">Die Lernkarten konnten nicht geladen werden. Prüfe, ob die LernLoop-Datenbankmigration bereits ausgeführt wurde.</div>
        : <LernLoop initialCards={(data ?? []) as LernLoopCard[]} />}
    </main>
  );
}
