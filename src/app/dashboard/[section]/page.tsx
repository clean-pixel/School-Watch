import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClass, createHomework, createAnnouncement, createEvent, createTimetableEntry, sendSchoolMessage, reviewTeacher, approveRegistration, assignStudentToClass, assignTeacherToClass } from "@/app/dashboard/actions";

const titles: Record<string, string> = { classes: "Klassen", teachers: "Lehrkräfte", timetable: "Stundenplan", homework: "Hausaufgaben", messages: "Nachrichten", announcements: "Schulmeldungen", events: "Termine", devices: "Geräteverwaltung", settings: "Einstellungen", platform: "Plattformverwaltung" };
const statusText: Record<string, string> = { saved: "Änderungen gespeichert.", assigned: "Zuordnung gespeichert.", error: "Speichern fehlgeschlagen. Prüfe deine Berechtigung und Verbindung.", invalid: "Bitte prüfe deine Eingaben.", approved: "Lehrkraft wurde freigeschaltet.", rejected: "Lehrkraft wurde abgelehnt.", "keine-berechtigung": "Für diese Aktion fehlt die Berechtigung.", "teacher-subject": "Die Lehrkraft muss dieses Fach unterrichten und es muss für die Klasse hinterlegt sein.", "not-assigned": "Du bist dieser Klasse bzw. diesem Fach noch nicht zugeordnet.", "class-conflict": "Diese Klasse hat zu dieser Zeit bereits Unterricht.", "teacher-conflict": "Diese Lehrkraft hat zu dieser Zeit bereits Unterricht.", "teacher-required": "Bitte wähle eine Lehrkraft für diese Stunde aus." };
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
  if (section === "devices" && profile.role !== "school_admin") return <main className="container"><h1>Kein Zugriff</h1><p>Die Geräteverwaltung ist nur für die Schulleitung freigeschaltet.</p><Link href="/dashboard">Zur Übersicht</Link></main>;
  if (section === "teachers" && profile.role !== "school_admin") return <main className="container"><h1>Kein Zugriff</h1><p>Die Lehrkraftverwaltung ist nur für die Schulleitung freigeschaltet.</p><Link href="/dashboard">Zur Übersicht</Link></main>;
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
    const result = await supabase.from("message_recipients").select("message_id,read_at,recipient_id,messages(subject,body,created_at),profiles:profiles!message_recipients_recipient_id_fkey(display_name)").order("message_id", { ascending: false }); rows = (result.data ?? []) as unknown as Row[]; loadError = !!result.error;
  } else if (section === "devices") {
    const result = await supabase.from("devices").select("id,status,last_seen_at,created_at").order("created_at", { ascending: false }); rows = (result.data ?? []) as Row[]; loadError = !!result.error;
  }
  let classes: SchoolClass[] = [];
  let teacherAssignments: { class_id: string; subject: string }[] = [];
  if (["classes", "homework", "timetable", "platform"].includes(section) && profile.school_id) {
    const result = await supabase.from("classes").select("id,name").eq("school_id", profile.school_id).order("name");
    classes = result.data ?? [];
    if (profile.role === "teacher") {
      const assignmentResult = await supabase.from("teacher_assignments").select("class_id,subject")
        .eq("school_id", profile.school_id).eq("teacher_id", user.id);
      teacherAssignments = assignmentResult.data ?? [];
      const assignedIds = new Set(teacherAssignments.map((item) => item.class_id));
      classes = classes.filter((item) => assignedIds.has(item.id));
      loadError = loadError || !!assignmentResult.error;
    }
  }
  let students: Person[] = [];
  if (section === "messages" && canManage && profile.school_id) {
    const result = await supabase.from("profiles").select("id,display_name").eq("school_id", profile.school_id).eq("role", "student").eq("registration_status", "approved").order("display_name"); students = result.data ?? [];
  }
  let studentsForClasses: Person[] = [];
  let teachersForClasses: Person[] = [];
  if (section === "classes" && profile.role === "school_admin" && profile.school_id) {
    const [studentResult, teacherResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name").eq("school_id", profile.school_id).eq("role", "student").eq("registration_status", "approved").order("display_name"),
      supabase.from("teachers").select("id").eq("school_id", profile.school_id),
    ]);
    studentsForClasses = studentResult.data ?? [];
    if (teacherResult.data?.length) {
      const teacherProfiles = await supabase.from("profiles").select("id,display_name").in("id", teacherResult.data.map((teacher) => teacher.id)).eq("school_id", profile.school_id).eq("role", "teacher").eq("registration_status", "approved").order("display_name");
      teachersForClasses = teacherProfiles.data ?? [];
    }
    loadError = loadError || !!studentResult.error || !!teacherResult.error;
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
    {section === "classes" && profile.role === "school_admin" && canManage && <form className="card" action={createClass}><h2>Klasse anlegen</h2><label className="field">Klassenname<input name="name" required maxLength={80} /></label><label className="field">Jahrgang (optional)<input name="grade" maxLength={40} /></label><button className="button">Klasse speichern</button></form>}
    {section === "classes" && profile.role === "school_admin" && classes.length > 0 && studentsForClasses.length > 0 && <form className="card" action={assignStudentToClass}><h2>Schüler/in einer Klasse zuordnen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Schüler/in<select name="studentId" required defaultValue=""><option value="" disabled>Person auswählen</option>{studentsForClasses.map((student) => <option key={student.id} value={student.id}>{student.display_name ?? "Schüler/in"}</option>)}</select></label><button className="button">Zuordnung speichern</button></form>}
    {section === "classes" && profile.role === "school_admin" && classes.length > 0 && teachersForClasses.length > 0 && <form className="card" action={assignTeacherToClass}><h2>Lehrkraft einer Klasse und einem Fach zuordnen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Lehrkraft<select name="teacherId" required defaultValue=""><option value="" disabled>Person auswählen</option>{teachersForClasses.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.display_name ?? "Lehrkraft"}</option>)}</select></label><label className="field">Fach<input name="subject" required maxLength={100} placeholder="Exakte Fachbezeichnung aus dem Klassenlehrplan"/></label><button className="button">Zuordnung speichern</button></form>}
    {section === "homework" && profile.role === "teacher" && <form className="card" action={createHomework}><h2>Hausaufgabe erstellen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Fach<input name="subject" required maxLength={100} placeholder="Muss zu deiner Klassen-Fach-Zuordnung passen"/></label><label className="field">Unterrichtsthema / Lernziel für die Lern-KI<input name="learningScope" required maxLength={1000} placeholder="z. B. Brüche addieren mit gleichem Nenner"/></label><label className="field">Aufgabenstellung<textarea name="description" required maxLength={4000} rows={4}/></label><label className="field">Fällig am<input type="datetime-local" name="dueAt" required/></label><button className="button">Hausaufgabe veröffentlichen</button></form>}
    {section === "timetable" && canManage && <form className="card" action={createTimetableEntry}><h2>Unterrichtsstunde eintragen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Wochentag<select name="weekday" defaultValue="1">{["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"].map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label><label className="field">Fach<input name="subject" required maxLength={100} /></label><label className="field">Beginn<input name="startsAt" type="time" required /></label><label className="field">Ende<input name="endsAt" type="time" required /></label><label className="field">Raum (optional)<input name="room" maxLength={80} /></label><button className="button">Stunde speichern</button></form>}
    {section === "messages" && canManage && <form className="card" action={sendSchoolMessage}><h2>Nachricht an Schüler/in senden</h2><label className="field">Empfänger/in<select name="recipientId" required defaultValue=""><option value="" disabled>Person auswählen</option>{students.map((student) => <option key={student.id} value={student.id}>{student.display_name ?? "Schüler/in"}</option>)}</select></label><label className="field">Betreff<input name="subject" required maxLength={160} /></label><label className="field">Nachricht<textarea name="body" required maxLength={5000} rows={4} /></label><button className="button">Nachricht senden</button></form>}
    {section === "announcements" && canManage && <form className="card" action={createAnnouncement}><h2>Schulmeldung veröffentlichen</h2><label className="field">Titel<input name="title" required maxLength={160} /></label><label className="field">Meldung<textarea name="body" required maxLength={5000} rows={4} /></label><button className="button">Meldung veröffentlichen</button></form>}
    {section === "events" && canManage && <form className="card" action={createEvent}><h2>Termin erstellen</h2><label className="field">Titel<input name="title" required maxLength={160} /></label><label className="field">Beschreibung<textarea name="description" maxLength={4000} rows={3} /></label><label className="field">Beginn<input type="datetime-local" name="startsAt" required /></label><button className="button">Termin speichern</button></form>}
    {rows.length ? rows.map((row, index) => { const message = row.messages as Row | null; const nestedClass = row.classes as Row | null; const recipientProfile = row.profiles as Row | null; const heading = row.title ?? row.subject ?? row.name ?? message?.subject ?? nestedClass?.name ?? "Eintrag"; const descriptionValue = row.description ?? row.body ?? message?.body ?? (row.grade ? `Jahrgang ${row.grade}` : ""); const description = descriptionValue == null ? "" : String(descriptionValue); return <article className="card" key={String(row.id ?? row.message_id ?? row.class_id ?? index)}><h2 style={{ fontSize: "1.3rem" }}>{String(heading)}</h2>{description !== "" && <p>{description}</p>}{section === "messages" && canManage && <p>Empfänger: {String(recipientProfile?.display_name ?? "Schüler/in")} · {Boolean(row.read_at) ? "Gelesen" : "Noch nicht gelesen"}</p>}{Boolean(row.due_at) && <p>Fällig: {new Date(String(row.due_at)).toLocaleString("de-DE")}</p>}{Boolean(row.starts_at) && <p>Beginn: {new Date(String(row.starts_at)).toLocaleString("de-DE")}</p>}{Boolean(row.weekday) && <p>{["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"][Number(row.weekday)]} · {String(row.starts_at)}–{String(row.ends_at)} · {String(row.room ?? "")}</p>}</article>; }) : !loadError && !["platform", "teachers"].includes(section) && <article className="card"><p>Noch keine Einträge vorhanden. Es werden keine Beispieldaten angezeigt.</p></article>}
    <p><Link href="/dashboard">Zur Übersicht</Link></p>
  </main>;
}
