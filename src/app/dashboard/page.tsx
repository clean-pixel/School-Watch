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
  if (!profile) return <main className="container"><h1>Konto wird eingerichtet</h1><p>Bitte bestätige zuerst deine E-Mail und melde dich danach erneut an.</p></main>;

  const { data: school } = profile.school_id
    ? await supabase.from("schools").select("id,name,school_type,city").eq("id", profile.school_id).maybeSingle()
    : { data: null };

  if (profile.role === "teacher" && profile.registration_status === "pending") {
    return <main className="container"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link><form action="/auth/signout" method="post"><button className="button secondary">Abmelden</button></form></header><section className="card"><div className="eyebrow">Lehrkraftzugang</div><h1 style={{ fontSize: "2.5rem" }}>Freigabe ausstehend</h1><p>Die ausgewählte Schule muss deine Lehrkraft-Anmeldung bestätigen. Danach ist der Schulbereich verfügbar.</p></section></main>;
  }

  const schoolAdmin = profile.role === "school_admin";
  const links = schoolAdmin || profile.role === "teacher"
    ? [["Übersicht", "/dashboard"], ["Klassen", "/dashboard/classes"], ["Lehrkräfte", "/dashboard/teachers"], ["Stundenplan", "/dashboard/timetable"], ["Vertretungsplan", "/dashboard/substitutions"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Geräte", "/dashboard/devices"], ["Einstellungen", "/dashboard/settings"]]
    : [["Übersicht", "/dashboard"], ["Mein Stundenplan", "/dashboard/timetable"], ["Meine Klassen", "/dashboard/classes"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Einstellungen", "/dashboard/settings"]];

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
      <aside className="sidebar"><strong>{roleNames[profile.role] ?? "Konto"}</strong>{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</aside>
      <section>
        <div className="eyebrow">Dein persönlicher Bereich</div>
        <h1 style={{ fontSize: "2.6rem" }}>Willkommen{profile.display_name ? `, ${profile.display_name}` : ""}</h1>
        {school && <article className="card"><div className="eyebrow">Deine Schule</div><h2 style={{ fontSize: "1.7rem" }}>{school.name}</h2><p>{school.school_type} · {school.city}</p><p>Schul-ID: <code>{school.id}</code></p>{schoolAdmin && <p>Du bist als Schulleitung angemeldet und kannst hier Klassen, Stundenpläne und Schulbereiche verwalten.</p>}</article>}
        {!profile.school_id && <div className="notice">Dein Konto ist noch keiner Schule zugeordnet.</div>}
        {schoolAdmin && <div className="grid"><article className="card"><h3>Klassen</h3><div className="stat">{classCount ?? 0}</div></article><article className="card"><h3>Lehrkräfte</h3><div className="stat">{teacherCount ?? 0}</div></article><article className="card"><h3>Schüler</h3><div className="stat">{studentCount ?? 0}</div></article></div>}
        <h2>Deine Bereiche</h2><div className="grid">{links.filter(([label]) => label !== "Übersicht").map(([label, href]) => <Link className="card" href={href} key={href}><h3>{label} →</h3><p>Öffnen und verwalten</p></Link>)}</div>
      </section>
    </div>
  </main>;
}
