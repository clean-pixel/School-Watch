import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClass, createHomework, createAnnouncement, createEvent, createTimetableEntry, sendSchoolMessage, reviewTeacher, approveRegistration } from "@/app/dashboard/actions";

const titles: Record<string, string> = { classes: "Klassen", teachers: "Lehrkräfte", timetable: "Stundenplan", homework: "Hausaufgaben", messages: "Nachrichten", announcements: "Schulmeldungen", events: "Termine", devices: "Geräteverwaltung", settings: "Einstellungen", platform: "Plattformverwaltung" };
const statusText: Record<string, string> = { saved: "Änderungen gespeichert.", error: "Speichern fehlgeschlagen. Prüfe deine Berechtigung und Verbindung.", invalid: "Bitte prüfe deine Eingaben.", approved: "Lehrkraft wurde freigeschaltet.", rejected: "Lehrkraft wurde abgelehnt.", "keine-berechtigung": "Für diese Aktion fehlt die Berechtigung." };
type Row = Record<string, unknown>;
type Person = { id: string; display_name: string | null };
type SchoolClass = { id: string; name: string };

export default async function DashboardSection({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ status?: string }> }) {
  const { section } = await params;
  const { status } = await searchParams;
  const title = titles[section];
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/anmelden");
  if (!title) return <main className="container"><p>Bereich nicht gefunden.</p><Link href="/dashboard">Zur Übersicht</Link></main>;
  if (profile.registration_status === "pending" && profile.role === "teacher") return <main className="container"><h1>Freigabe ausstehend</h1><p>Die ausgewählte Schule muss deine Lehrkraft-Registrierung zuerst bestätigen. Du kannst den Schulbereich danach nutzen.</p><Link href="/dashboard">Zur Übersicht</Link></main>;
  if (profile.registration_status !== "approved" && profile.role !== "platform_admin") return <main className="container"><h1>Konto nicht freigeschaltet</h1><p>Wende dich an die Schulverwaltung.</p><Link href="/dashboard">Zur Übersicht</Link></main>;

  const elevated = profile.registration_status === "approved" && !!profile.school_id;
  const canManage = elevated && ["school_admin", "teacher"].includes(profile.role);
  let rows: Row[] = [];
  let loadError = false;
  if (section === "classes") {
    const result = profile.role === "student" ? await supabase.from("class_memberships").select("class_id,classes(name,grade)").eq("student_id", user.id) : await supabase.from("classes").select("id,name,grade").order("name");
    rows = (result.data ?? []) as unknown as Row[]; loadError = !!result.error;
  } else if (section === "homework") {
    const result = await supabase.from("homework").select("id,subject,description,due_at").order("due_at"); rows = (result.data ?? []) as Row[]; loadError = !!result.error;
  } else if (section === "announcements") {
    const result = await supabase.from("announcements").select("id,title,body,published_at").not("published_at", "is", null).order("published_at", { ascending: false }); rows = (result.data ?? []) as Row[]; loadError = !!result.error;
  } else if (section === "events") {
    const result = await supabase.from("school_events").select("id,title,description,starts_at").order("starts_at"); rows = (result.data ?? []) as Row[]; loadError = !!result.error;
  } else if (section === "timetable") {
    const result = await supabase.from("timetable_entries").select("id,weekday,starts_at,ends_at,subject,room").order("weekday").order("starts_at"); rows = (result.data ?? []) as Row[]; loadError = !!result.error;
  } else if (section === "messages") {
    const result = await supabase.from("message_recipients").select("message_id,read_at,messages(subject,body,created_at)"); rows = (result.data ?? []) as unknown as Row[]; loadError = !!result.error;
  } else if (section === "devices") {
    const result = await supabase.from("devices").select("id,status,last_seen_at,created_at").order("created_at", { ascending: false }); rows = (result.data ?? []) as Row[]; loadError = !!result.error;
  }
  let classes: SchoolClass[] = [];
  if (["homework", "timetable", "platform"].includes(section) && profile.school_id) {
    const result = await supabase.from("classes").select("id,name").eq("school_id", profile.school_id).order("name"); classes = result.data ?? [];
  }
  let students: Person[] = [];
  if (section === "messages" && canManage && profile.school_id) {
    const result = await supabase.from("profiles").select("id,display_name").eq("school_id", profile.school_id).eq("role", "student").eq("registration_status", "approved").order("display_name"); students = result.data ?? [];
  }
  let teacherRequests: { id: string; teacher_id: string; created_at: string; profiles: { display_name: string | null } | null }[] = [];
  if (section === "teachers" && profile.role === "school_admin" && profile.school_id) {
    const result = await supabase.from("teacher_join_requests").select("id,teacher_id,created_at,profiles!teacher_join_requests_teacher_id_fkey(display_name)").eq("school_id", profile.school_id).eq("state", "pending").order("created_at");
    teacherRequests = (result.data ?? []) as unknown as typeof teacherRequests; loadError = !!result.error;
  }
  let registrations: { id: string; school_name: string; school_type: string; city: string; created_at: string }[] = [];
  if (section === "platform") {
    if (profile.role !== "platform_admin") return <main className="container"><h1>Kein Zugriff</h1><p>Dieser Bereich ist Plattformadministratoren vorbehalten.</p></main>;
    const result = await supabase.from("school_registration_requests").select("id,school_name,school_type,city,created_at").eq("state", "pending").order("created_at"); registrations = result.data ?? []; loadError = !!result.error;
  }
  if (section === "settings") return <main className="container"><header className="topbar"><Link href="/dashboard">← Übersicht</Link></header><h1>{title}</h1><article className="card"><p>Rolle: {profile.role}</p><p>Schul-ID: {profile.school_id ?? "Keine Schule"}</p></article></main>;

  return <main className="container"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">Übersicht</Link></header>
    <div className="eyebrow">Geschützter Bereich</div><h1 style={{ fontSize: "2.7rem" }}>{title}</h1>
    {status && <div className="notice" role="status">{statusText[status] ?? "Aktion abgeschlossen."}</div>}
    {loadError && <div className="notice" role="alert">Daten konnten nicht geladen werden. Prüfe Supabase-Migrationen und Berechtigungen.</div>}
    {section === "platform" && <><p>Schulen sind bei der Registrierung sofort verfügbar. Offene Anträge können aus älteren Registrierungen stammen.</p>{registrations.map((item) => <article className="card" key={item.id}><h2>{item.school_name}</h2><p>{item.school_type} · {item.city} · {new Date(item.created_at).toLocaleDateString("de-DE")}</p><form action={approveRegistration}><input type="hidden" name="requestId" value={item.id} /><button className="button">Schule freischalten</button></form></article>)}</>}
    {section === "teachers" && profile.role === "school_admin" && <><p>Hier bestätigst du Lehrkräfte, die sich für deine Schule registriert haben.</p>{teacherRequests.map((request) => <article className="card" key={request.id}><h2>{request.profiles?.display_name ?? "Lehrkraft"}</h2><p>Registriert: {new Date(request.created_at).toLocaleDateString("de-DE")}</p><div className="actions"><form action={reviewTeacher}><input type="hidden" name="requestId" value={request.id} /><button className="button" name="decision" value="approve">Lehrkraft bestätigen</button></form><form action={reviewTeacher}><input type="hidden" name="requestId" value={request.id} /><button className="button secondary" name="decision" value="reject">Ablehnen</button></form></div></article>)}{teacherRequests.length === 0 && !loadError && <article className="card"><p>Keine offenen Lehrkraft-Anmeldungen.</p></article>}</>}
    {section === "classes" && profile.role !== "student" && canManage && <form className="card" action={createClass}><h2>Klasse anlegen</h2><label className="field">Klassenname<input name="name" required maxLength={80} /></label><label className="field">Jahrgang (optional)<input name="grade" maxLength={40} /></label><button className="button">Klasse speichern</button></form>}
    {section === "homework" && canManage && <form className="card" action={createHomework}><h2>Hausaufgabe erstellen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Fach<input name="subject" required maxLength={100} /></label><label className="field">Aufgabe<textarea name="description" required maxLength={4000} rows={4} /></label><label className="field">Fällig am<input type="datetime-local" name="dueAt" required /></label><button className="button">Hausaufgabe veröffentlichen</button></form>}
    {section === "timetable" && canManage && <form className="card" action={createTimetableEntry}><h2>Unterrichtsstunde eintragen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Wochentag<select name="weekday" defaultValue="1">{["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label><label className="field">Fach<input name="subject" required maxLength={100} /></label><label className="field">Beginn<input name="startsAt" type="time" required /></label><label className="field">Ende<input name="endsAt" type="time" required /></label><label className="field">Raum (optional)<input name="room" maxLength={80} /></label><button className="button">Stunde speichern</button></form>}
    {section === "messages" && canManage && <form className="card" action={sendSchoolMessage}><h2>Nachricht an Schüler/in senden</h2><label className="field">Empfänger/in<select name="recipientId" required defaultValue=""><option value="" disabled>Person auswählen</option>{students.map((student) => <option key={student.id} value={student.id}>{student.display_name ?? "Schüler/in"}</option>)}</select></label><label className="field">Betreff<input name="subject" required maxLength={160} /></label><label className="field">Nachricht<textarea name="body" required maxLength={5000} rows={4} /></label><button className="button">Nachricht senden</button></form>}
    {section === "announcements" && canManage && <form className="card" action={createAnnouncement}><h2>Schulmeldung veröffentlichen</h2><label className="field">Titel<input name="title" required maxLength={160} /></label><label className="field">Meldung<textarea name="body" required maxLength={5000} rows={4} /></label><button className="button">Meldung veröffentlichen</button></form>}
    {section === "events" && canManage && <form className="card" action={createEvent}><h2>Termin erstellen</h2><label className="field">Titel<input name="title" required maxLength={160} /></label><label className="field">Beschreibung<textarea name="description" maxLength={4000} rows={3} /></label><label className="field">Beginn<input type="datetime-local" name="startsAt" required /></label><button className="button">Termin speichern</button></form>}
    {rows.length ? rows.map((row, index) => { const message = row.messages as Row | null; const nestedClass = row.classes as Row | null; const heading = row.title ?? row.subject ?? row.name ?? message?.subject ?? nestedClass?.name ?? "Eintrag"; const description = row.description ?? row.body ?? message?.body ?? (row.grade ? `Jahrgang ${row.grade}` : ""); return <article className="card" key={String(row.id ?? row.message_id ?? row.class_id ?? index)}><h2 style={{ fontSize: "1.3rem" }}>{String(heading)}</h2>{description && <p>{String(description)}</p>}{row.due_at && <p>Fällig: {new Date(String(row.due_at)).toLocaleString("de-DE")}</p>}{row.starts_at && <p>Beginn: {new Date(String(row.starts_at)).toLocaleString("de-DE")}</p>}{row.weekday && <p>{["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][Number(row.weekday)]} · {String(row.starts_at)}–{String(row.ends_at)} · {String(row.room ?? "")}</p>}</article>; }) : !loadError && !["platform", "teachers"].includes(section) && <article className="card"><p>Noch keine Einträge vorhanden. Es werden keine Beispieldaten angezeigt.</p></article>}
    <p><Link href="/dashboard">Zur Übersicht</Link></p>
  </main>;
}
