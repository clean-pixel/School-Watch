import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClassSetupWizard } from "./class-setup-wizard";

export default async function ClassSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("role,school_id,registration_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "school_admin" ||
      profile.registration_status !== "approved" || !profile.school_id) {
    redirect("/dashboard");
  }

  const { data: classes } = await supabase.from("classes")
    .select("id,name,grade")
    .eq("school_id", profile.school_id)
    .order("name");

  return (
    <main className="container class-setup-page">
      <header className="topbar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
        <Link href="/dashboard">← Übersicht</Link>
      </header>
      <div className="eyebrow">Geführte Schuleinrichtung</div>
      <h1 style={{ fontSize: "2.7rem" }}>Klassenassistent</h1>
      <p className="class-setup-intro">Die SchulWatch KI hilft dir, deine Klassen in wenigen Schritten anzulegen. Du musst nicht jede Klasse einzeln erstellen.</p>
      <ClassSetupWizard existingClasses={(classes ?? []).map((item) => ({ ...item, grade: item.grade ?? null }))} />
    </main>
  );
}
