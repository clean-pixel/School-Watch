import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClassSubject } from "@/app/dashboard/actions";
import { SchoolResearchPanel } from "./school-research-panel";
import { SchoolStartWizard } from "./school-start-wizard";

export default async function SchoolSetupPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "school_admin" || profile.registration_status !== "approved" || !profile.school_id) redirect("/dashboard");

  const [schoolResult, classesResult, subjectResult] = await Promise.all([
    supabase.from("schools").select("name,state,city,day_start_time,day_end_time").eq("id", profile.school_id).maybeSingle(),
    supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).order("name"),
    supabase.from("class_subjects").select("class_id,subject,weekly_periods_a,weekly_periods_b").eq("school_id", profile.school_id).order("subject"),
  ]);
  const school = schoolResult.data;
  if (!school) redirect("/dashboard");
  const classes = classesResult.data ?? [];
  const subjects = subjectResult.data ?? [];
  const statusText: Record<string,string> = {
    saved:"Änderungen gespeichert.",
    "research-saved":"Die bestätigten Klassen- und Fächervorschläge wurden angelegt.",
    invalid:"Bitte prüfe deine Eingaben.",
    permission:"Die Änderung wurde nicht gespeichert: Prüfe, ob dein Konto als freigegebene Schulleitung deiner eigenen Schule angemeldet ist.",
    error:"Speichern fehlgeschlagen. Bitte lade die Seite neu. Falls der Fehler bleibt, melde ihn über Fehler melden & Punkte.",
  };

  return <main className="container">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">← Übersicht</Link></header>
    <div className="eyebrow">Einrichtung für die Schulleitung</div>
    <h1 style={{fontSize:"2.7rem"}}>Schulprofil & Lehrpläne</h1>
    {status && <div className="notice" role="status">{statusText[status] || "Aktion abgeschlossen."}</div>}
    <SchoolResearchPanel
      school={{name:school.name,state:school.state,city:school.city}}
      dayStart={school.day_start_time}
      dayEnd={school.day_end_time}
      classesCount={classes.length}
    />
    <section className="section">
      <h2>Fächer einer Klasse ergänzen</h2>
      <form action={createClassSubject} className="card formgrid">
        <label className="field">Klasse
          <select name="classId" required defaultValue="">
            <option value="" disabled>Klasse auswählen</option>
            {classes.map((item)=><option key={item.id} value={item.id}>{item.name}{item.grade ? ` · Jahrgang ${item.grade}` : ""}</option>)}
          </select>
        </label>
        <label className="field">Fach
          <input name="subject" required maxLength={100} placeholder="z. B. Mathematik"/>
        </label>
        <label className="field">Wochenstunden A-Woche (optional)
          <input type="number" min="0" max="30" name="weeklyPeriodsA"/>
        </label>
        <label className="field">Wochenstunden B-Woche (optional)
          <input type="number" min="0" max="30" name="weeklyPeriodsB"/>
        </label>
        <div className="full"><button className="button">Fach hinzufügen</button></div>
      </form>
      <div className="grid">
        {classes.map((item)=><article className="card" key={item.id}>
          <h3>{item.name}{item.grade ? ` · Jahrgang ${item.grade}` : ""}</h3>
          <p>{subjects.filter((subject)=>subject.class_id===item.id).map((subject)=>`${subject.subject} (A: ${subject.weekly_periods_a ?? "–"}× / B: ${subject.weekly_periods_b ?? "–"}×)`).join(" · ") || "Noch keine Fächer eingetragen."}</p>
        </article>)}
      </div>
    </section>
  </main>;
}
