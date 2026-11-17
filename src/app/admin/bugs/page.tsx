import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewBugReport } from "../actions";

type AdminBugPageProps = { searchParams: Promise<{ status?: string }> };

export default async function AdminBugReportsPage({ searchParams }: AdminBugPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "platform_admin") redirect("/dashboard");

  const [{ data: reports, error }, query] = await Promise.all([
    supabase.from("bug_reports")
      .select("id,reporter_id,title,description,page_path,severity,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    searchParams,
  ]);

  return <main className="container" style={{ padding: "32px 0 80px" }}>
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <nav className="navlinks"><Link href="/admin">Plattform-Admin</Link><Link href="/dashboard">Dashboard</Link></nav>
    </header>
    <div className="eyebrow">Plattformverwaltung</div>
    <h1 style={{ fontSize: "2.6rem" }}>Bug-Meldungen prüfen</h1>
    <p>Prüfe, ob der Fehler nachvollziehbar ist. Für jede angenommene Meldung werden automatisch 25 Punkte gutgeschrieben.</p>
    {query.status === "approved" && <div className="notice" role="status">Meldung angenommen. 25 Punkte wurden vergeben.</div>}
    {query.status === "rejected" && <div className="notice" role="status">Meldung abgelehnt. Es wurden keine Punkte vergeben.</div>}
    {query.status === "error" && <div className="notice" role="alert">Die Meldung konnte nicht aktualisiert werden.</div>}
    {error && <div className="notice" role="alert">Die Bug-Meldungen konnten nicht geladen werden. Prüfe die Datenbank-Migration.</div>}
    {!error && (reports ?? []).length === 0 && <article className="card"><h2>Keine offenen Meldungen</h2><p>Aktuell müssen keine Bugs geprüft werden.</p></article>}
    <div className="bug-history">
      {(reports ?? []).map((report) => <article className="card" key={report.id}>
        <div className="eyebrow">{report.severity === "high" ? "Hohe Priorität" : report.severity === "low" ? "Niedrige Priorität" : "Normale Priorität"}</div>
        <h2 style={{ fontSize: "1.45rem" }}>{report.title}</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{report.description}</p>
        {report.page_path && <p>Seite: <code>{report.page_path}</code></p>}
        <p><small>Meldung von {report.reporter_id.slice(0, 8)} · {new Date(report.created_at).toLocaleString("de-DE")}</small></p>
        <div className="actions">
          <form action={reviewBugReport}>
            <input type="hidden" name="reportId" value={report.id} />
            <button className="button" name="decision" value="approve">Annehmen · +25 Punkte</button>
          </form>
          <form action={reviewBugReport}>
            <input type="hidden" name="reportId" value={report.id} />
            <button className="button secondary" name="decision" value="reject">Ablehnen</button>
          </form>
        </div>
      </article>)}
    </div>
  </main>;
}
