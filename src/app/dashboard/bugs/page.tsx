import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitBugReport } from "./actions";

type BugPageProps = { searchParams: Promise<{ status?: string }> };

const statusLabels: Record<string, string> = {
  pending: "Wird geprüft",
  accepted: "Angenommen · Punkte erhalten",
  rejected: "Nicht als Bug bestätigt",
};

export default async function BugReportsPage({ searchParams }: BugPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("display_name,registration_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.registration_status !== "approved") redirect("/dashboard");

  const [{ data: reports, error }, query] = await Promise.all([
    supabase.from("bug_reports")
      .select("id,title,description,page_path,severity,status,reward_points,created_at")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    searchParams,
  ]);

  const points = (reports ?? []).reduce((total, report) => total + report.reward_points, 0);
  const unlocked = [
    { points: 25, title: "Bug-Scout", detail: "Dein erster bestätigter Fund" },
    { points: 75, title: "Fehlerjäger", detail: "Du hilfst aktiv beim Verbessern" },
    { points: 150, title: "SchulWatch-Held", detail: "Du hast besonders viel beigetragen" },
  ];

  return <main className="container" style={{ paddingBottom: 72 }}>
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <Link href="/dashboard">← Übersicht</Link>
    </header>
    <div className="eyebrow">Community hilft mit</div>
    <h1 style={{ fontSize: "2.6rem" }}>Fehler melden</h1>
    <p>Findest du einen Fehler? Beschreibe kurz, was passiert ist. Jede bestätigte, hilfreiche Meldung bringt dir 25 Punkte.</p>

    <section className="grid bug-stats">
      <article className="card"><div className="eyebrow">Dein Punktestand</div><div className="stat">{points} Punkte</div><p>Nur angenommene Meldungen zählen.</p></article>
      <article className="card"><div className="eyebrow">Deine Auszeichnungen</div>
        {unlocked.filter((item) => points >= item.points).length
          ? unlocked.filter((item) => points >= item.points).map((item) => <p key={item.title}>🏅 <strong>{item.title}</strong></p>)
          : <p>Noch keine Auszeichnung freigeschaltet. Deine erste bestätigte Meldung bringt dir den Bug-Scout.</p>}
      </article>
      <article className="card"><div className="eyebrow">Nächste Auszeichnung</div>
        {unlocked.find((item) => points < item.points)
          ? <><h3>{unlocked.find((item) => points < item.points)!.title}</h3><p>{Math.max(0, unlocked.find((item) => points < item.points)!.points - points)} Punkte fehlen noch.</p></>
          : <><h3>Alle Abzeichen erreicht!</h3><p>Danke, dass du SchulWatch besser machst.</p></>}
      </article>
    </section>

    {query.status === "submitted" && <div className="notice" role="status">Danke! Deine Bug-Meldung wurde eingereicht und wird geprüft.</div>}
    {query.status === "invalid" && <div className="notice" role="alert">Bitte fülle Titel und Beschreibung vollständig aus.</div>}
    {query.status === "error" && <div className="notice" role="alert">Die Meldung konnte nicht gespeichert werden. Bitte versuche es später erneut.</div>}

    <form className="card bug-form" action={submitBugReport}>
      <h2>Was ist passiert?</h2>
      <label className="field">Kurzer Titel<input name="title" required minLength={4} maxLength={120} placeholder="z. B. Stundenplan wird nicht angezeigt" /></label>
      <label className="field">Beschreibung<textarea name="description" required minLength={10} maxLength={3000} rows={5} placeholder="Was hast du gemacht und was ist stattdessen passiert?" /></label>
      <label className="field">Wo ist der Fehler aufgetreten? (optional)<input name="pagePath" maxLength={200} placeholder="/dashboard/timetable" /></label>
      <label className="field">Wie schlimm ist der Fehler?
        <select name="severity" defaultValue="normal">
          <option value="low">Klein – etwas sieht falsch aus</option>
          <option value="normal">Normal – eine Funktion klappt nicht</option>
          <option value="high">Hoch – ein wichtiger Bereich ist nicht nutzbar</option>
        </select>
      </label>
      <p className="small-note">Bitte gib keine Passwörter, privaten Daten oder vertraulichen Informationen an. Punkte werden erst vergeben, wenn die Plattform-Administration den Fehler bestätigt. Doppelte oder unklare Meldungen bekommen keine Punkte.</p>
      <button className="button">Bug-Meldung abschicken</button>
    </form>

    <section className="section">
      <h2>Deine Meldungen</h2>
      {error && <div className="notice">Deine Meldungen konnten nicht geladen werden. Bitte lade die Seite neu.</div>}
      {!error && (reports ?? []).length === 0 && <article className="card"><p>Du hast noch keine Fehler gemeldet.</p></article>}
      <div className="bug-history">
        {(reports ?? []).map((report) => <article className="card" key={report.id}>
          <div className="bug-history-heading"><strong>{report.title}</strong><span className={"bug-status " + report.status}>{statusLabels[report.status] ?? report.status}</span></div>
          <p>{report.description}</p>
          <small>{new Date(report.created_at).toLocaleString("de-DE")} · {report.severity === "high" ? "Hohe Priorität" : report.severity === "low" ? "Kleine Auffälligkeit" : "Normale Priorität"}</small>
          {report.reward_points > 0 && <p className="bug-points">+{report.reward_points} Punkte</p>}
        </article>)}
      </div>
    </section>
  </main>;
}
