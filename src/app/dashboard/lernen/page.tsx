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

  const allowedRoles = ["student", "teacher", "school_admin", "platform_admin"];
  if (!profile || !allowedRoles.includes(profile.role) ||
      (profile.role !== "platform_admin" && profile.registration_status !== "approved")) {
    redirect("/dashboard");
  }

  const isStudent = profile.role === "student";
  return <main className="container learning-page teacher-ai-page">
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <Link href="/dashboard">← Übersicht</Link>
    </header>
    <div className="eyebrow">{isStudent ? "Dein persönlicher Lernassistent" : "Dein KI-Assistent für Schul- und Unterrichtsfragen"}</div>
    <h1 style={{ fontSize: "2.7rem" }}>SchulWatch KI</h1>
    <p>{isStudent
      ? "Ein freier Chat wie ChatGPT: Stelle Fragen zu jedem Schulfach, lass dir Themen erklären, übe für Klassenarbeiten oder beginne ein ganz neues Gespräch."
      : "Ein freier Chat wie ChatGPT für Fragen, Ideen, Texte und den Schulalltag. Für Fach-Chats und spezielle Lehrkräfte-Werkzeuge kannst du zusätzlich den Lehrer-KI-Bereich nutzen."}</p>
    <LearningTutor userRole={profile.role} />
  </main>;
}
