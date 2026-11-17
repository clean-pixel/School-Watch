import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorksheetGenerator } from "./worksheet-generator";

export default async function WorksheetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || !profile.school_id || profile.registration_status !== "approved" || !["school_admin", "teacher"].includes(profile.role)) redirect("/dashboard");

  const classResult = await supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).order("name");
  const classes = classResult.data ?? [];
  const subjectResult = classes.length
    ? await supabase.from("class_subjects").select("class_id,subject").eq("school_id", profile.school_id).in("class_id", classes.map((item) => item.id)).order("subject")
    : { data: [] };

  const { data: worksheets } = await supabase.from("lesson_worksheets")
    .select("id,title,subject,topic,is_published,created_at,classes(name)")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false })
    .limit(20);

  return <main className="container">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">← Übersicht</Link></header>
    <div className="eyebrow">Lehrkraft-Werkstatt</div>
    <h1 style={{fontSize:"2.7rem"}}>Arbeitsblätter mit KI</h1>
    <p>Erstelle Übungen aus deinen Unterrichtszielen. Prüfe den Inhalt vor dem Speichern und entscheide selbst, ob das Blatt für Schüler freigegeben wird.</p>
    <WorksheetGenerator classes={classes} subjects={subjectResult.data ?? []} />
    <section className="section">
      <h2>Gespeicherte Arbeitsblätter</h2>
      <div className="grid">
        {(worksheets ?? []).map((worksheet) => (
          <article className="card" key={worksheet.id}>
            <h3>{worksheet.title}</h3>
            <p>{worksheet.subject} · {worksheet.topic}</p>
            <p>{worksheet.is_published ? "Für Schüler freigegeben" : "Nur für Lehrkräfte sichtbar"} · {new Date(worksheet.created_at).toLocaleDateString("de-DE")}</p>
          </article>
        ))}
      </div>
      {(worksheets ?? []).length === 0 && <article className="card"><p>Du hast noch keine Arbeitsblätter gespeichert.</p></article>}
    </section>
  </main>;
}
