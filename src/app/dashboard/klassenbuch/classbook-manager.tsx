"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClassOption = { id: string; name: string; grade: string | null };
type StudentOption = { id: string; name: string };
type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type ClassbookEntryView = {
  id: string;
  subject: string;
  lesson_date: string;
  period: number | null;
  lesson_topic: string;
  lesson_content: string;
  homework: string;
  teacher_notes: string;
  created_at: string;
  attendance: string[];
};
const statusLabels: Record<AttendanceStatus, string> = {
  present: "Anwesend",
  absent: "Fehlt",
  late: "Verspätet",
  excused: "Entschuldigt",
};

export function ClassbookManager({ classes, selectedClassId, subjects, roster, entries, today }: {
  classes: ClassOption[];
  selectedClassId: string;
  subjects: string[];
  roster: StudentOption[];
  entries: ClassbookEntryView[];
  today: string;
}) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(roster.map((student) => [student.id, "present"]))
  );
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [lessonDate, setLessonDate] = useState(today);
  const [period, setPeriod] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [homework, setHomework] = useState("");
  const [teacherNotes, setTeacherNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClassId || !subject || !lessonTopic.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/teacher/classbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          subject,
          lessonDate,
          period: period ? Number(period) : null,
          lessonTopic,
          lessonContent,
          homework,
          teacherNotes,
          attendance: roster.map((student) => ({ studentId: student.id, status: attendance[student.id] ?? "present" })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Der Eintrag konnte nicht gespeichert werden.");
      setNotice("Der Unterrichtseintrag wurde im Klassenbuch gespeichert.");
      setLessonTopic("");
      setLessonContent("");
      setHomework("");
      setTeacherNotes("");
      setPeriod("");
      setAttendance(Object.fromEntries(roster.map((student) => [student.id, "present"])));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Der Eintrag konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="classbook-layout">
    <form className="card classbook-class-picker" method="get">
      <label className="field">Klasse auswählen
        <select name="classId" defaultValue={selectedClassId}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.grade ? " · " + item.grade : ""}</option>)}</select>
      </label>
      <button className="button secondary">Klasse öffnen</button>
    </form>

    <form className="card classbook-form" onSubmit={save}>
      <div className="classbook-form-heading">
        <div><div className="eyebrow">Neue Unterrichtsstunde</div><h2>Eintrag erstellen</h2></div>
        <span className="classbook-count">{roster.length} Schüler/innen</span>
      </div>
      <div className="formgrid">
        <label className="field">Fach
          <select value={subject} onChange={(event) => setSubject(event.target.value)} required>
            {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">Datum
          <input type="date" value={lessonDate} onChange={(event) => setLessonDate(event.target.value)} required />
        </label>
        <label className="field">Stunde (optional)
          <input type="number" min={1} max={12} value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="z. B. 3" />
        </label>
        <label className="field full">Unterrichtsthema
          <input value={lessonTopic} onChange={(event) => setLessonTopic(event.target.value)} required maxLength={200} placeholder="z. B. Lineare Funktionen – Steigung" />
        </label>
        <label className="field full">Behandelte Inhalte
          <textarea rows={3} maxLength={12000} value={lessonContent} onChange={(event) => setLessonContent(event.target.value)} placeholder="Welche Inhalte und Aufgaben wurden behandelt?" />
        </label>
        <label className="field full">Hausaufgaben
          <textarea rows={2} maxLength={4000} value={homework} onChange={(event) => setHomework(event.target.value)} placeholder="Aufgabe und Abgabetermin (falls vorhanden)" />
        </label>
        <label className="field full">Interne Notizen der Lehrkraft
          <textarea rows={2} maxLength={4000} value={teacherNotes} onChange={(event) => setTeacherNotes(event.target.value)} placeholder="Optionale organisatorische Notiz – keine sensiblen Schülerdaten" />
        </label>
      </div>

      <section className="classbook-attendance">
        <div className="classbook-form-heading"><div><h3>Anwesenheit</h3><p>Alle Personen starten mit „Anwesend“. Ändere nur die Abweichungen.</p></div></div>
        {roster.length === 0 ? <p>Für diese Klasse ist noch keine Schülerliste hinterlegt.</p> : <div className="classbook-roster">
          {roster.map((student) => <label className="classbook-student" key={student.id}>
            <span>{student.name}</span>
            <select value={attendance[student.id] ?? "present"} onChange={(event) => setAttendance((current) => ({ ...current, [student.id]: event.target.value as AttendanceStatus }))}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>)}
        </div>}
      </section>
      {error && <div className="notice" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      <button className="button" disabled={busy || !subject || !lessonTopic.trim()}>{busy ? "Speichert …" : "Im Klassenbuch speichern"}</button>
    </form>

    <section className="classbook-history">
      <div className="classbook-form-heading"><div><div className="eyebrow">Dokumentation</div><h2>Letzte Unterrichtseinträge</h2></div><span className="classbook-count">{entries.length} Einträge</span></div>
      {entries.length === 0 ? <article className="card"><p>Für diese Klasse gibt es noch keine Klassenbucheinträge.</p></article> : entries.map((entry) => {
        const counts = entry.attendance.reduce((acc, status) => {
          acc[status] = (acc[status] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        return <article className="card classbook-entry" key={entry.id}>
          <div className="classbook-entry-meta">
            <span>{new Date(entry.lesson_date + "T12:00:00").toLocaleDateString("de-DE")}</span>
            <span>{entry.subject}{entry.period ? " · " + entry.period + ". Stunde" : ""}</span>
          </div>
          <h3>{entry.lesson_topic}</h3>
          {entry.lesson_content && <p>{entry.lesson_content}</p>}
          {entry.homework && <div className="classbook-homework"><strong>Hausaufgaben</strong><p>{entry.homework}</p></div>}
          {entry.teacher_notes && <div className="classbook-notes"><strong>Interne Notiz</strong><p>{entry.teacher_notes}</p></div>}
          <div className="classbook-attendance-summary">
            <span>{counts.present ?? 0} anwesend</span>
            <span>{counts.absent ?? 0} fehlt</span>
            <span>{counts.late ?? 0} verspätet</span>
            <span>{counts.excused ?? 0} entschuldigt</span>
          </div>
        </article>;
      })}
    </section>
  </div>;
}
