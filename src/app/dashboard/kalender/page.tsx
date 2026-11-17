import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createScheduleChange } from "@/app/dashboard/student-actions";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.registration_status !== "approved" || !profile.school_id) redirect("/dashboard");
  const isStudent = profile.role === "student";
  const [{ data: memberships }, { data: classes }, { data: events }, { data: exams }, { data: changes }, { data: homework }] = await Promise.all([
    isStudent ? supabase.from("class_memberships").select("class_id").eq("student_id", user.id) : Promise.resolve({ data: [] as { class_id: string }[] }),
    !isStudent ? supabase.from("classes").select("id,name").eq("school_id", profile.school_id).order("name") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("school_events").select("id,title,starts_at,description").eq("school_id", profile.school_id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(50),
    supabase.from("exams").select("id,title,subject,starts_at,class_id").eq("school_id", profile.school_id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(50),
    supabase.from("schedule_changes").select("id,title,details,change_type,applies_at,class_id").eq("school_id", profile.school_id).gte("applies_at", new Date().toISOString()).order("applies_at").limit(50),
    supabase.from("homework").select("id,subject,description,due_at,class_id").eq("school_id", profile.school_id).gte("due_at", new Date().toISOString()).order("due_at").limit(50),
  ]);
  const classIds = memberships?.map((item) => item.class_id) ?? [];
  const allowed = (classId: string | null) => !isStudent || (!!classId && classIds.includes(classId));
  const items = [
    ...(events ?? []).filter((item) => !isStudent || item.class_id === null || allowed(item.class_id)).map((item) => ({ id: item.id, title: item.title, detail: item.description ?? "Schulveranstaltung", at: item.starts_at, kind: "Termin" })),
    ...(exams ?? []).filter((item) => allowed(item.class_id)).map((item) => ({ id: item.id, title: `${item.subject}: ${item.title}`, detail: "Klassenarbeit", at: item.starts_at, kind: "Prüfung" })),
    ...(changes ?? []).filter((item) => allowed(item.class_id)).map((item) => ({ id: item.id, title: item.title, detail: item.details || item.change_type, at: item.applies_at, kind: "Vertretung" })),
    ...(homework ?? []).filter((item) => allowed(item.class_id)).map((item) => ({ id: item.id, title: `Hausaufgabe: ${item.subject}`, detail: item.description, at: item.due_at, kind: "Abgabe" })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return <main className="container"><header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">Übersicht</Link></header><div className="eyebrow">Dein Schulkalender</div><h1 style={{ fontSize: "2.5rem" }}>Kalender</h1><p>Tages- und Wochenübersicht deiner anstehenden Termine, Abgaben, Prüfungen und Stundenplanänderungen.</p>
    {status && <div className="notice" role={status === "saved" ? "status" : "alert"}>{status === "saved" ? "Änderung gespeichert." : status === "invalid" ? "Bitte prüfe deine Eingaben und das Datum." : "Die Änderung konnte nicht gespeichert werden. Prüfe die Berechtigungen und Datenbankverbindung."}</div>}
    {!isStudent && <form className="card" action={createScheduleChange}><h2>Vertretung / Änderung veröffentlichen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classes?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field">Art<select name="type"><option value="cancelled">Unterricht fällt aus</option><option value="room">Raumänderung</option><option value="teacher">Vertretungslehrkraft</option><option value="rescheduled">Stunde verschoben</option></select></label><label className="field">Titel<input name="title" required maxLength={160}/></label><label className="field">Details<textarea name="details" maxLength={2000}/></label><label className="field">Gilt ab<input name="appliesAt" type="datetime-local" required/></label><button className="button">Änderung veröffentlichen</button></form>}
    {items.length ? items.map((item) => <article className="card calendar-item" key={`${item.kind}-${item.id}`}><span className="eyebrow">{item.kind}</span><h2>{item.title}</h2><p>{new Date(item.at).toLocaleString("de-DE")}</p><p>{item.detail}</p></article>) : <article className="card"><p>Keine anstehenden Kalendereinträge.</p></article>}
  </main>;
}
