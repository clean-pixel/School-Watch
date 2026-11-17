import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createTimetableEntry } from "@/app/dashboard/actions";
import { TimetableBoard, type TimetableEntryView } from "./timetable-board";

type Search = { classId?: string; status?: string };

export default async function TimetablePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { classId: requestedClassId, status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || !profile.school_id || profile.registration_status !== "approved" || !["school_admin", "teacher"].includes(profile.role)) redirect("/dashboard");

  const [schoolResult, classResult] = await Promise.all([
    supabase.from("schools").select("name,state,day_start_time,day_end_time").eq("id", profile.school_id).maybeSingle(),
    supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).order("name"),
  ]);
  const school = schoolResult.data;
  const classes = classResult.data ?? [];
  const selectedClass = classes.find((item) => item.id === requestedClassId) ?? classes[0] ?? null;

  let entries: TimetableEntryView[] = [];
  let timetableId: string | null = null;
  let classSubjects: string[] = [];
  if (selectedClass) {
    const [timetableResult, subjectResult] = await Promise.all([
      supabase.from("timetables").select("id").eq("school_id", profile.school_id).eq("class_id", selectedClass.id).order("created_at").limit(1).maybeSingle(),
      supabase.from("class_subjects").select("subject").eq("school_id", profile.school_id).eq("class_id", selectedClass.id).order("subject"),
    ]);
    timetableId = timetableResult.data?.id ?? null;
    classSubjects = (subjectResult.data ?? []).map((item) => item.subject);

    if (timetableId) {
      const entryResult = await supabase.from("timetable_entries")
        .select("id,weekday,starts_at,ends_at,subject,room,teacher_id,week_type")
        .eq("school_id", profile.school_id)
        .eq("timetable_id", timetableId)
        .order("weekday").order("starts_at");
      const rawEntries = entryResult.data ?? [];
      const teacherIds = [...new Set(rawEntries.map((entry) => entry.teacher_id).filter((id): id is string => !!id))];
      const names = new Map<string, string>();
      if (teacherIds.length) {
        const profileRows = await supabase.from("profiles").select("id,display_name").in("id", teacherIds);
        for (const person of profileRows.data ?? []) names.set(person.id, person.display_name || "Lehrkraft");
      }
      entries = rawEntries.map((entry) => ({
        ...entry,
        week_type: entry.week_type as "both" | "A" | "B",
        teacher_name: entry.teacher_id ? names.get(entry.teacher_id) ?? "Lehrkraft" : null,
      }));
    }
  }

  const teacherRows = await supabase.from("teachers").select("id,subjects").eq("school_id", profile.school_id);
  const teacherIds = (teacherRows.data ?? []).map((item) => item.id);
  const teacherNames = teacherIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", teacherIds).eq("registration_status", "approved")
    : { data: [] as { id: string; display_name: string | null }[] };
  const teachers = (teacherRows.data ?? []).map((teacher) => ({
    id: teacher.id,
    name: teacherNames.data?.find((item) => item.id === teacher.id)?.display_name || "Lehrkraft",
    subjects: teacher.subjects ?? [],
  })).filter((teacher) => profile.role === "school_admin" || teacher.id === user.id);

  const availableSubjects = classSubjects.length
    ? classSubjects
    : [...new Set(teachers.flatMap((teacher) => teacher.subjects))].sort();

  const statusText: Record<string, string> = {
    saved: "Unterrichtsstunde gespeichert.",
    error: "Die Stunde konnte nicht gespeichert werden. Prüfe die Klasse, Fach- und Lehrkraftzuordnung.",
    invalid: "Bitte prüfe die Angaben. Die Endzeit muss nach der Startzeit liegen.",
    "teacher-subject": "Die ausgewählte Lehrkraft ist für dieses Fach nicht eingetragen. Trage das Fach zuerst in der Lehrkraftverwaltung ein.",
  };

  return (
    <main className="container">
      <header className="topbar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
        <Link href="/dashboard">← Übersicht</Link>
      </header>
      <div className="eyebrow">Stundenplanung</div>
      <h1 style={{ fontSize: "2.7rem" }}>Stundenplan</h1>
      <p>Plane jede Klasse einzeln. Unterricht kann jede Woche, nur in der A-Woche oder nur in der B-Woche stattfinden.</p>
      {status && <div className="notice" role="status">{statusText[status] ?? "Aktion abgeschlossen."}</div>}
      {classes.length === 0 ? <article className="card"><p>Für deine Schule gibt es noch keine sichtbaren Klassen. Die Schulleitung kann Klassen in der Schulverwaltung anlegen.</p></article> : <>
        <form className="card timetable-class-picker" method="get">
          <label className="field">Klasse auswählen
            <select name="classId" defaultValue={selectedClass?.id ?? ""}>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.grade ? ` · Jahrgang ${item.grade}` : ""}</option>)}
            </select>
          </label>
          <button className="button secondary">Klasse öffnen</button>
        </form>
        {selectedClass && <>
          <TimetableBoard
            entries={entries}
            schoolStart={school?.day_start_time ?? "07:45"}
            schoolEnd={school?.day_end_time ?? "17:00"}
            canEdit={true}
          />
          <form className="card" action={createTimetableEntry}>
            <h2>Stundenkasten hinzufügen</h2>
            <input type="hidden" name="classId" value={selectedClass.id} />
            <div className="formgrid">
              <label className="field">Wochentag
                <select name="weekday" defaultValue="1">{["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"].map((day,index)=><option key={day} value={index+1}>{day}</option>)}</select>
              </label>
              <label className="field">Fach
                <select name="subject" required defaultValue="">
                  <option value="" disabled>Fach auswählen</option>
                  {availableSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </label>
              <label className="field">Start
                <input type="time" name="startsAt" defaultValue={school?.day_start_time?.slice(0,5) ?? "07:45"} required />
              </label>
              <label className="field">Ende
                <input type="time" name="endsAt" defaultValue="08:30" required />
              </label>
              <label className="field">Lehrkraft
                <select name="teacherId" defaultValue={profile.role === "teacher" ? user.id : ""}>
                  <option value="">Noch nicht zugeordnet</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}{teacher.subjects.length ? ` · ${teacher.subjects.join(", ")}` : ""}</option>)}
                </select>
              </label>
              <label className="field">Woche
                <select name="weekType" defaultValue="both">
                  <option value="both">Jede Woche (A + B)</option>
                  <option value="A">Nur A-Woche</option>
                  <option value="B">Nur B-Woche</option>
                </select>
              </label>
              <label className="field full">Raum (optional)<input name="room" maxLength={80} /></label>
            </div>
            <button className="button">Stunde hinzufügen</button>
          </form>
          {availableSubjects.length === 0 && <div className="notice">Für diese Klasse sind noch keine Fächer hinterlegt. Die Schulleitung kann sie unter „Schulprofil & Lehrpläne“ eintragen oder recherchieren lassen.</div>}
        </>}
      </>}
      <p><Link href="/dashboard/schule-setup">Schulzeiten und Fächer bearbeiten →</Link></p>
    </main>
  );
}
