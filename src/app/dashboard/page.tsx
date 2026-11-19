import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LearningTutor } from "./lernen/learning-tutor";

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
    ? [["Übersicht", "/dashboard"], ["Plattformverwaltung", "/dashboard/platform"], ["KI-Chat", "/dashboard/lernen"], ["Bug-Meldungen prüfen", "/admin/bugs"], ["Bug melden", "/dashboard/bugs"], ["Schulanträge", "/admin"], ["Einstellungen", "/dashboard/settings"]]
    : schoolAdmin
      ? [["Übersicht", "/dashboard"], ["Schulprofil & KI-Einrichtung", "/dashboard/schule-setup"], ["Klassen", "/dashboard/classes"], ["Lehrkräfte & Fächer", "/dashboard/teachers"], ["Stundenplan", "/dashboard/timetable"], ["Arbeitsblätter mit KI", "/dashboard/arbeitsblaetter"], ["KI-Chat", "/dashboard/lernen"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Kalender & Vertretungen", "/dashboard/kalender"], ["Prüfungsplaner", "/dashboard/pruefungsplaner"], ["Geräte", "/dashboard/devices"], ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Bug melden", "/dashboard/bugs"], ["Einstellungen", "/dashboard/settings"]]
      : profile.role === "teacher"
        ? [["Übersicht", "/dashboard"], ["Klassen", "/dashboard/classes"], ["Stundenplan", "/dashboard/timetable"], ["Lehrer-KI & Fach-Chats", "/dashboard/lehrer-ki"], ["Allgemeiner KI-Chat", "/dashboard/lernen"], ["Digitales Klassenbuch", "/dashboard/klassenbuch"], ["Arbeitsblätter mit KI", "/dashboard/arbeitsblaetter"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Kalender & Vertretungen", "/dashboard/kalender"], ["Prüfungsplaner", "/dashboard/pruefungsplaner"], ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Bug melden", "/dashboard/bugs"], ["Einstellungen", "/dashboard/settings"]]
        : [["Übersicht", "/dashboard"], ["Mein Stundenplan", "/dashboard/timetable"], ["Meine Klassen", "/dashboard/classes"], ["Lern-KI", "/dashboard/lernen"], ["Hausaufgaben", "/dashboard/homework"], ["Nachrichten", "/dashboard/messages"], ["Schulmeldungen", "/dashboard/announcements"], ["Termine", "/dashboard/events"], ["Kalender", "/dashboard/kalender"], ["Prüfungsplaner", "/dashboard/pruefungsplaner"], ["LernLoop – KI-Lernkarten", "/dashboard/lernloop"], ["Fokusmodus", "/dashboard/focus"], ["Toilettenanfragen", "/dashboard/toilet-requests"], ["Bug melden", "/dashboard/bugs"], ["Einstellungen", "/dashboard/settings"]];

  const groupForLink = (href: string) => {
    if (href === "/dashboard") return "Start";
    if (["timetable", "classes", "homework", "lernen", "lehrer-ki", "klassenbuch", "arbeitsblaetter", "pruefungsplaner", "lernloop", "focus"].some((part) => href.includes(part))) return "Lernen & Unterricht";
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


  type StudentAgendaItem = { id: string; kind: string; title: string; detail: string; at: string };
  const studentAgenda: StudentAgendaItem[] = [];
  let studentAgendaError = false;
  let studentHasClasses = false;

  if (profile.role === "student" && profile.school_id) {
    const membershipResult = await supabase
      .from("class_memberships")
      .select("class_id")
      .eq("school_id", profile.school_id)
      .eq("student_id", user.id);
    studentAgendaError = !!membershipResult.error;
    const classIds = (membershipResult.data ?? []).map((membership) => membership.class_id);
    studentHasClasses = classIds.length > 0;

    if (classIds.length > 0) {
      const now = new Date().toISOString();
      const [homeworkResult, examResult, changeResult] = await Promise.all([
        supabase.from("homework")
          .select("id,subject,description,due_at")
          .eq("school_id", profile.school_id)
          .in("class_id", classIds)
          .gte("due_at", now)
          .order("due_at", { ascending: true })
          .limit(5),
        supabase.from("exams")
          .select("id,subject,title,starts_at")
          .eq("school_id", profile.school_id)
          .in("class_id", classIds)
          .gte("starts_at", now)
          .order("starts_at", { ascending: true })
          .limit(5),
        supabase.from("schedule_changes")
          .select("id,change_type,title,details,applies_at")
          .eq("school_id", profile.school_id)
          .in("class_id", classIds)
          .gte("applies_at", now)
          .order("applies_at", { ascending: true })
          .limit(5),
      ]);

      studentAgendaError = studentAgendaError || !!homeworkResult.error || !!examResult.error || !!changeResult.error;
      studentAgenda.push(
        ...(homeworkResult.data ?? []).map((item) => ({
          id: "homework-" + item.id,
          kind: "Hausaufgabe",
          title: item.subject,
          detail: item.description,
          at: item.due_at,
        })),
        ...(examResult.data ?? []).map((item) => ({
          id: "exam-" + item.id,
          kind: "Klassenarbeit",
          title: item.subject + " · " + item.title,
          detail: "Dein Prüfungstermin",
          at: item.starts_at,
        })),
        ...(changeResult.data ?? []).map((item) => ({
          id: "change-" + item.id,
          kind: item.change_type === "cancelled" ? "Unterrichtsausfall"
            : item.change_type === "room" ? "Raumänderung"
            : item.change_type === "teacher" ? "Lehrkraftänderung" : "Stundenplanänderung",
          title: item.title,
          detail: item.details,
          at: item.applies_at,
        })),
      );
      studentAgenda.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }
  }

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
        {schoolAdmin && profile.school_id && (classCount ?? 0) === 0 && <article className="card" style={{ margin: "20px 0", borderColor: "var(--border-strong)" }}>
          <div className="eyebrow">Dein erster Schulstart</div>
          <h2 style={{ fontSize: "1.55rem" }}>Die KI richtet deine Schule mit dir ein.</h2>
          <p>Sie fragt dich nach Klassenstufen, Parallelklassen, Fächern und Schulzeiten. Bestätigte Angaben werden direkt in deiner Schulverwaltung angelegt.</p>
          <LearningTutor
            userRole="school_admin"
            initialTitle="Schule mit KI einrichten"
            initialPrompt="Ich möchte meine neu erstellte Schule vollständig einrichten. Führe mich bitte Schritt für Schritt durch die Einrichtung und stelle mir zuerst die wichtigste Frage."
            onboardingMode
          />
        </article>}
        {school && <article className="card"><div className="eyebrow">Deine Schule</div><h2 style={{ fontSize: "1.7rem" }}>{school.name}</h2><p>{school.school_type} · {school.city}</p><p>Schul-ID: <code>{school.id}</code></p>{schoolAdmin && <p>Du bist als Schulleitung angemeldet und kannst hier Klassen, Stundenpläne und Schulbereiche verwalten.</p>}</article>}
        {!profile.school_id && <div className="notice">Dein Konto ist noch keiner Schule zugeordnet.</div>}
        {schoolAdmin && <div className="grid"><article className="card"><h3>Klassen</h3><div className="stat">{classCount ?? 0}</div></article><article className="card"><h3>Lehrkräfte</h3><div className="stat">{teacherCount ?? 0}</div></article><article className="card"><h3>Schüler</h3><div className="stat">{studentCount ?? 0}</div></article></div>}
        {profile.role === "student" && <section className="dashboard-group" style={{ margin: "26px 0" }}>
          <div className="eyebrow">Dein persönlicher Tages-Kompass</div>
          <h2>Was steht als Nächstes an?</h2>
          <article className="card">
            {studentAgendaError
              ? <p>Deine Schultermine konnten gerade nicht geladen werden.</p>
              : studentAgenda.length > 0
                ? studentAgenda.slice(0, 7).map((item) => <div className="row" key={item.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="eyebrow">{item.kind}</div>
                      <strong>{item.title}</strong>
                      {item.detail && <p style={{ margin: "5px 0 0", fontSize: ".88rem" }}>{item.detail}</p>}
                    </div>
                    <span style={{ flex: "0 0 auto", color: "var(--muted)", fontSize: ".82rem", textAlign: "right" }}>
                      {new Date(item.at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>)
                : studentHasClasses
                  ? <p>Es stehen gerade keine kommenden Hausaufgaben, Klassenarbeiten oder Stundenplanänderungen in deinem Kompass.</p>
                  : <p>Sobald du einer Klasse zugeordnet bist und Termine eingetragen sind, erscheinen deine nächsten Aufgaben und Änderungen hier automatisch.</p>}
          </article>
        </section>}
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
