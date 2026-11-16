import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ToiletRequestPanel } from "@/components/toilet-request-panel";

const roles: Record<string, string> = { platform_admin: "Plattformadministration", school_admin: "Schuladministration", teacher: "Lehrkraft", student: "Schüler" };
const links = [
  ["Übersicht", "/dashboard"], ["Klassen", "/dashboard/classes"], ["Stundenplan", "/dashboard/timetable"],
  ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"],
  ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Termine", "/dashboard/events"], ["Geräte", "/dashboard/devices"], ["Einstellungen", "/dashboard/settings"],
];
export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("display_name,role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile) return <main className="container"><p>Dein Profil wird vorbereitet. Bitte bestätige deine E-Mail und melde dich erneut an.</p><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></main>;

  const isPending = profile.registration_status === "pending";
  const isStudent = profile.role === "student";
  const [classes, homework, announcements, events, toilets] = await Promise.all([
    supabase.from("class_memberships").select("class_id,classes(name)").eq("student_id", user.id).limit(10),
    supabase.from("homework").select("id,subject,description,due_at").order("due_at", { ascending: true }).limit(5),
    supabase.from("announcements").select("id,title,body,published_at").not("published_at", "is", null).order("published_at", { ascending: false }).limit(4),
    supabase.from("school_events").select("id,title,starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(4),
    supabase.from("toilet_requests").select("id,status,created_at,student_id,teacher_id").order("created_at", { ascending: false }).limit(10),
  ]);
  const ownToilets = (toilets.data ?? []).filter((item) => isStudent ? item.student_id === user.id : item.teacher_id === user.id);
  const count = (table: "students" | "teachers" | "classes") => supabase.from(table).select("id", { count: "exact", head: true });
  const stats = profile.role === "school_admin" ? await Promise.all([count("students"), count("teachers"), count("classes")]) : [];

  return <main className="container"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></header>
    <div className="dash"><aside className="sidebar"><strong>{roles[profile.role] ?? "Konto"}</strong>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</aside>
      <section><div className="eyebrow">Persönlicher Bereich</div><h1 style={{ fontSize: "2.6rem" }}>Willkommen{profile.display_name ? `, ${profile.display_name}` : ""}</h1>
        {isPending && <div className="notice" role="status">Dein Schulregistrierungsantrag wird geprüft. Funktionen für die Schulverwaltung bleiben bis zur Freigabe gesperrt.</div>}
        <p>Deine Ansicht richtet sich nach deiner Rolle. Angezeigte Informationen werden aus der Datenbank geladen; Zugriffe sind zusätzlich durch Supabase-RLS eingeschränkt.</p>
        {profile.role === "school_admin" && <div className="grid">{["Schüler", "Lehrkräfte", "Klassen"].map((label, i) => <article className="card" key={label}><h3>{label}</h3><div className="stat">{stats[i]?.count ?? "—"}</div></article>)}</div>}
        {isStudent && <div className="card"><h2>Toilettenanfrage</h2><p>Eine digitale Anfrage ersetzt keine dringende persönliche Kommunikation und ist keine Garantie für eine sofortige Antwort.</p><ToiletRequestPanel /></div>}
        <div className="grid"><article className="card"><h3>{isStudent ? "Deine Klassen" : "Zugehörige Klassen"}</h3>{classes.error ? <p>Daten konnten nicht geladen werden.</p> : classes.data?.length ? classes.data.map((item) => <p key={item.class_id}>{(item.classes as unknown as {name:string} | null)?.name ?? "Klasse"}</p>) : <p>Noch keine Klassenzuordnung vorhanden.</p>}</article>
          <article className="card"><h3>{isStudent ? "Nächste Hausaufgaben" : "Hausaufgaben"}</h3>{homework.error ? <p>Daten konnten nicht geladen werden.</p> : homework.data?.length ? homework.data.map((item) => <p key={item.id}><b>{item.subject}</b> · {new Date(item.due_at).toLocaleDateString("de-DE")}</p>) : <p>Keine Hausaufgaben verfügbar.</p>}<Link href="/dashboard/homework">Alle Hausaufgaben →</Link></article>
          <article className="card"><h3>Schulmeldungen</h3>{announcements.error ? <p>Daten konnten nicht geladen werden.</p> : announcements.data?.length ? announcements.data.map((item) => <p key={item.id}><b>{item.title}</b><br/>{item.body}</p>) : <p>Keine veröffentlichten Meldungen.</p>}</article>
          <article className="card"><h3>Anstehende Termine</h3>{events.error ? <p>Daten konnten nicht geladen werden.</p> : events.data?.length ? events.data.map((item) => <p key={item.id}>{new Date(item.starts_at).toLocaleString("de-DE")} · {item.title}</p>) : <p>Keine anstehenden Termine.</p>}</article>
          {(profile.role === "teacher" || profile.role === "school_admin") && <article className="card"><h3>Toilettenanfragen</h3>{toilets.error ? <p>Daten konnten nicht geladen werden.</p> : ownToilets.length ? ownToilets.map((item) => <p key={item.id}>{item.status === "pending" ? "Wartet auf Antwort" : item.status === "approved" ? "Erlaubt" : item.status === "denied" ? "Abgelehnt" : item.status}</p>) : <p>Keine sichtbaren Anfragen.</p>}<Link href="/dashboard/toilet-requests">Anfragen öffnen →</Link></article>}
        </div>
        {!profile.school_id && <div className="notice">Dein Konto ist noch keiner freigegebenen Schule zugeordnet. Bitte keine echten Schülerdaten eintragen, bevor Einrichtung und Datenschutz geprüft sind.</div>}
      </section></div></main>;
}
