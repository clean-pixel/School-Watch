import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WatchScreen from "./watch-screen";

type TimetableItem = {
  id: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
};

type HomeworkItem = {
  id: string;
  subject: string;
  description: string;
  dueAt: string;
};

type MessageItem = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type ChangeItem = {
  id: string;
  subject: string | null;
  room: string | null;
  note: string | null;
  occursOn: string;
};

const demoTimetable: TimetableItem[] = [
  { id: "demo-1", subject: "Mathematik", startsAt: "08:00:00", endsAt: "08:45:00", room: "204" },
  { id: "demo-2", subject: "Deutsch", startsAt: "08:50:00", endsAt: "09:35:00", room: "108" },
  { id: "demo-3", subject: "Englisch", startsAt: "09:55:00", endsAt: "10:40:00", room: "212" },
  { id: "demo-4", subject: "Biologie", startsAt: "10:45:00", endsAt: "11:30:00", room: "Fachraum B1" },
];

const demoHomework: HomeworkItem[] = [
  { id: "demo-homework-1", subject: "Mathematik", description: "Buch Seite 42, Aufgaben 3–5", dueAt: new Date().toISOString() },
  { id: "demo-homework-2", subject: "Englisch", description: "Vokabeln aus Unit 4 wiederholen", dueAt: new Date(Date.now() + 86400000).toISOString() },
];

const demoMessages: MessageItem[] = [
  { id: "demo-message-1", subject: "Information zum Schulfest", body: "Das Schulfest findet am Freitag ab 14:00 Uhr auf dem Schulhof statt.", createdAt: new Date().toISOString(), read: false },
];

const demoChanges: ChangeItem[] = [
  { id: "demo-change-1", subject: "Deutsch", room: "112", note: "Der Unterricht findet heute in Raum 112 statt.", occursOn: new Date().toISOString().slice(0, 10) },
];

export default async function SchoolWatchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,role,school_id,registration_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/anmelden");
  if (profile.registration_status !== "approved") {
    return (
      <main className="container">
        <header className="topbar"><Link href="/dashboard">← Zur Übersicht</Link></header>
        <section className="card">
          <h1>SchoolWatch ist noch nicht verfügbar</h1>
          <p>Dein Schulkonto muss zuerst freigeschaltet sein.</p>
        </section>
      </main>
    );
  }

  const now = new Date();
  const timeZone = "Europe/Berlin";
  const timeLabel = new Intl.DateTimeFormat("de-DE", { timeZone, hour: "2-digit", minute: "2-digit" }).format(now);
  const dateLabel = new Intl.DateTimeFormat("de-DE", { timeZone, dateStyle: "full" }).format(now);
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now);
  const weekday = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(weekdayName) + 1;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

  let timetable = demoTimetable;
  let homework = demoHomework;
  let messages = demoMessages;
  let changes = demoChanges;
  let mode: "live" | "demo" = "demo";
  let dataWarning = false;

  if (profile.role === "student" && profile.school_id) {
    mode = "live";
    timetable = [];
    homework = [];
    messages = [];
    changes = [];

    const membershipResult = await supabase
      .from("class_memberships")
      .select("class_id")
      .eq("school_id", profile.school_id)
      .eq("student_id", user.id);

    dataWarning = !!membershipResult.error;
    const classIds = (membershipResult.data ?? []).map((item) => item.class_id);

    const messageResult = await supabase
      .from("message_recipients")
      .select("message_id,read_at,messages(subject,body,created_at)")
      .eq("recipient_id", user.id)
      .limit(10);

    dataWarning = dataWarning || !!messageResult.error;
    messages = ((messageResult.data ?? []) as unknown as Array<{
      message_id: string;
      read_at: string | null;
      messages: { subject: string; body: string; created_at: string } | null;
    }>)
      .map((item) => ({
        id: item.message_id,
        subject: item.messages?.subject ?? "Schulnachricht",
        body: item.messages?.body ?? "",
        createdAt: item.messages?.created_at ?? "",
        read: !!item.read_at,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (classIds.length > 0) {
      const timetableResult = await supabase
        .from("timetables")
        .select("id")
        .eq("school_id", profile.school_id)
        .in("class_id", classIds);

      dataWarning = dataWarning || !!timetableResult.error;
      const timetableIds = (timetableResult.data ?? []).map((item) => item.id);

      const [entriesResult, homeworkResult, changesResult] = await Promise.all([
        timetableIds.length > 0
          ? supabase.from("timetable_entries")
              .select("id,weekday,starts_at,ends_at,subject,room")
              .eq("school_id", profile.school_id)
              .in("timetable_id", timetableIds)
              .eq("weekday", weekday)
              .order("starts_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        supabase.from("homework")
          .select("id,subject,description,due_at")
          .eq("school_id", profile.school_id)
          .in("class_id", classIds)
          .order("due_at", { ascending: true })
          .limit(10),
        supabase.from("substitutions")
          .select("id,subject,room,note,occurs_on")
          .eq("school_id", profile.school_id)
          .in("class_id", classIds)
          .eq("occurs_on", today)
          .order("occurs_on", { ascending: true }),
      ]);

      dataWarning = dataWarning || !!entriesResult.error || !!homeworkResult.error || !!changesResult.error;
      timetable = ((entriesResult.data ?? []) as Array<{
        id: string; subject: string; starts_at: string; ends_at: string; room: string | null;
      }>).map((item) => ({
        id: item.id, subject: item.subject, startsAt: item.starts_at, endsAt: item.ends_at, room: item.room,
      }));
      homework = ((homeworkResult.data ?? []) as Array<{
        id: string; subject: string; description: string; due_at: string;
      }>).map((item) => ({
        id: item.id, subject: item.subject, description: item.description, dueAt: item.due_at,
      }));
      changes = ((changesResult.data ?? []) as Array<{
        id: string; subject: string | null; room: string | null; note: string | null; occurs_on: string;
      }>).map((item) => ({
        id: item.id, subject: item.subject, room: item.room, note: item.note, occursOn: item.occurs_on,
      }));
    }
  }

  return (
    <main className="container">
      <header className="topbar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
        <Link href="/dashboard">Zur Übersicht</Link>
      </header>
      <div className="eyebrow">SchoolWatch OS · Uhrvorschau</div>
      <h1 style={{ fontSize: "2.35rem" }}>Deine SchoolWatch</h1>
      <p style={{ maxWidth: 680 }}>
        {mode === "live"
          ? "Diese Vorschau liest die freigegebenen Schul-Daten deines angemeldeten Schülerkontos."
          : "Vorschau für die Schulleitung und Lehrkräfte mit Beispieldaten. Schülerdaten werden nicht angezeigt."}
      </p>
      {dataWarning && <div className="notice" role="status">Einige Schul-Daten konnten gerade nicht geladen werden. Prüfe die Datenbankberechtigungen.</div>}
      <WatchScreen
        mode={mode}
        studentName={profile.display_name ?? "Schüler/in"}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        timetable={timetable}
        homework={homework}
        messages={messages}
        changes={changes}
      />
      <p style={{ marginTop: 22, color: "var(--muted)", fontSize: ".9rem" }}>
        Hinweis: Dies ist eine Browser-Vorschau von SchoolWatch OS. Die physische Uhr ist noch nicht mit der Plattform gekoppelt; dafür fehlt noch die sichere Geräte-API und Geräteaktivierung.
      </p>
    </main>
  );
}
