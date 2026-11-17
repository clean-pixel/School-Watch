import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LearningTutor } from "./learning-tutor";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("role,school_id,registration_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "student" || profile.registration_status !== "approved" || !profile.school_id) {
    redirect("/dashboard");
  }

  return <main className="container learning-page">
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <Link href="/dashboard">← Übersicht</Link>
    </header>
    <div className="eyebrow">Deine Lern-KI</div>
    <h1 style={{ fontSize: "2.7rem" }}>Frag einfach drauflos.</h1>
    <p>Stell Fragen zu Mathe, Deutsch, Englisch, Naturwissenschaften und vielem mehr. Die KI erklärt dir Dinge Schritt für Schritt.</p>
    <LearningTutor />
  </main>;
}
