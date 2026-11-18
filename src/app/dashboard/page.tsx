import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const roleNames: Record<string, string> = {
  platform_admin: "Plattformadministration",
  school_admin: "Schulleitung",
  teacher: "Lehrkraft",
  student: "Schülerbereich",
};

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,role,school_id,registration_status")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return <main className="container"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></header><section className="card"><h1 style={{ fontSize: "2.4rem" }}>Profil noch nicht eingerichtet</h1><p>Dein Konto ist angemeldet, aber das SchulWatch-Profil wurde noch nicht angelegt. Melde dich ab und erneut an. Falls die Meldung bleibt, kontaktiere bitte die Schulverwaltung.</p><Link className="button" href="/anmelden">Zur Anmeldung</Link></section></main>;

  const { data: school } = profile.school_id
    ? await supabase.from("schools").select("id,name,school_type,city").eq("id", profile.school_id).maybeSingle()
    : { data: null };

  if (profile.role === "teacher" && profile.registration_status === "pending") {
    return <main className="container"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></header><section className="card"><div className="eyebrow">Lehrkraftzugang</div><h1 style={{ fontSize: "2.5rem" }}>Freigabe ausstehend</h1><p>Die ausgewählte Schule muss deine Lehrkraft-Anmeldung bestätigen. Danach ist der Schulbereich verfügbar.</p></section></main>;
  }

  const schoolAdmin = profile.role === "school_admin";
  const platformAdmin = profile.role === "platform_admin";
  const links: [string, string][] = platformAdmin
    ? [["Übersicht", "/dashboard"], ["Plattformverwaltung", "/dashboard/platform"], ["Bug-Meldungen prüfen", "/admin/bugs"], ["Fehler melden & Punkte", "/dashboard/bugs"], ["Schulanträge", "/admin"], ["Einstellungen", "/dashboard/settings"]]
    : schoolAdmin
      ? [["Übersicht", "/dashboard"], ["Schulprofil & KI-Einrichtung", "/dashboard/schule-setup"], ["Klassen", "/dashboard/classes"], ["Lehrkräfte & Fächer", "/dashboard/teachers"], ["Stundenplan", "/dashboard/timetable"], ["Arbeitsblätter mit KI", "/dashboard/arbeitsblaetter"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Kalender & Vertretungen", "/dashboard/kalender"], ["Prüfungsplaner", "/dashboard/pruefungsplaner"], ["Geräte", "/dashboard/devices"], ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Fehler melden & Punkte", "/dashboard/bugs"], ["Einstellungen", "/dashboard/settings"]]
      : profile.role === "teacher"
        ? [["Übersicht", "/dashboard"], ["Klassen", "/dashboard/classes"], ["Stundenplan", "/dashboard/timetable"], ["Lehrer-KI & Fach-Chats", "/dashboard/lehrer-ki"], ["Digitales Klassenbuch", "/dashboard/klassenbuch"], ["Arbeitsblätter mit KI", "/dashboard/arbeitsblaetter"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Kalender & Vertretungen", "/dashboard/kalender"], ["Prüfungsplaner", "/dashboard/pruefungsplaner"], ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Fehler melden & Punkte", "/dashboard/bugs"], ["Einstellungen", "/dashboard/settings"]]
        : [["Übersicht", "/dashboard"], ["Mein Stundenplan", "/dashboard/timetable"], ["Meine Klassen", "/dashboard/classes"], ["Lern-KI", "/dashboard/lernen"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Kalender", "/dashboard/kalender"], ["Prüfungsplaner", "/dashboard/pruefungsplaner"], ["Fokusmodus", "/dashboard/focus"], ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Fehler melden & Punkte", "/dashboard/bugs"], ["Einstellungen", "/dashboard/settings"]];

  const groupForLink = (href: string) => {
    if (href === "/dashboard") return "Start";
    if (["timetable", "classes", "homework", "lernen", "lehrer-ki", "klassenbuch", "arbeitsblaetter", "pruefungsplaner", "focus"].some((part) => href.includes(part))) return "Lernen & Unterricht";
    if (["messages", "announcements", "events", "kalender", "toilet-requests"].some((part) => href.includes(part))) return "Schulalltag";
    return "Verwaltung & Hilfe";
  };
  const groupOrder = ["Start", "Lernen & Unterricht", "Schulalltag", "Verwaltung & Hilfe"];
  const linkGroups = groupOrder
    .map((title) => ({ title, items: links.filter(([, href]) => groupForLink(href) === title) }))
    .filter((group) => group.items.length > 0);

  const { count: classCount } = profile.school_id
    ? await supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id)
    : { count: null };
  const { count: teacherCount } = schoolAdmin && profile.school_id
    ? await supabase.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id)
    : { count: null };
  const { count: studentCount } = schoolAdmin && profile.school_id
    ? await supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", profile.school_id)
    : { count: null };

  return <main className="container">
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <nav className="navlinks"><span>{user.email}</span><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></nav>
    </header>
    <div className="dash">
      <aside className="sidebar"><strong>{roleNames[profile.role] ?? "Konto"}</strong>{linkGroups.map((group) => <div className="sidebar-group" key={group.title}><span className="sidebar-group-title">{group.title}</span>{group.items.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>)}</aside>
      <section>
        <div className="eyebrow">Dein persönlicher Bereich</div>
        <h1 style={{ fontSize: "2.6rem" }}>Willkommen{profile.display_name ? `, ${profile.display_name}` : ""}</h1>
        {school && <article className="card"><div className="eyebrow">Deine Schule</div><h2 style={{ fontSize: "1.7rem" }}>{school.name}</h2><p>{school.school_type} · {school.city}</p><p>Schul-ID: <code>{school.id}</code></p>{schoolAdmin && <p>Du bist als Schulleitung angemeldet und kannst hier Klassen, Stundenpläne und Schulbereiche verwalten.</p>}</article>}
        {!profile.school_id && <div className="notice">Dein Konto ist noch keiner Schule zugeordnet.</div>}
        {schoolAdmin && <div className="grid"><article className="card"><h3>Klassen</h3><div className="stat">{classCount ?? 0}</div></article><article className="card"><h3>Lehrkräfte</h3><div className="stat">{teacherCount ?? 0}</div></article><article className="card"><h3>Schüler</h3><div className="stat">{studentCount ?? 0}</div></article></div>}
        <div className="dashboard-groups">{linkGroups.map((group) => {
          const items = group.items.filter(([label]) => label !== "Übersicht");
          if (items.length === 0) return null;
          return <section className="dashboard-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="grid">{items.map(([label, href]) => <Link className="card" href={href} key={href}><h3>{label} →</h3><p>Bereich öffnen</p></Link>)}</div>
          </section>;
        })}</div>
      </section>
    </div>
  </main>;
}
