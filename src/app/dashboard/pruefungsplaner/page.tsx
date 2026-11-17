import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createExam, saveExamNote, addExamChecklistItem, toggleChecklistItem } from "@/app/dashboard/student-actions";

export default async function ExamPlannerPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.registration_status !== "approved") redirect("/dashboard");
  const student = profile.role === "student";
  const [examsResult, classesResult] = await Promise.all([
    supabase.from("exams").select("id,class_id,subject,title,starts_at").eq("school_id", profile.school_id).gte("starts_at", new Date().toISOString()).order("starts_at"),
    !student && profile.school_id ? supabase.from("classes").select("id,name").eq("school_id", profile.school_id).order("name") : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
  ]);
  const exams = examsResult.data ?? [];
  const [notesResult, checklistResult] = student && exams.length ? await Promise.all([
    supabase.from("exam_study_notes").select("exam_id,note").eq("student_id", user.id).in("exam_id", exams.map((exam) => exam.id)),
    supabase.from("exam_checklist_items").select("id,exam_id,label,is_done").eq("student_id", user.id).in("exam_id", exams.map((exam) => exam.id)),
  ]) : [{ data: [] as { exam_id: string; note: string }[] }, { data: [] as { id: string; exam_id: string; label: string; is_done: boolean }[] }];
  const notes = new Map((notesResult.data ?? []).map((note) => [note.exam_id, note.note]));
  const checklist = checklistResult.data ?? [];
  return <main className="container">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">Übersicht</Link></header>
    <div className="eyebrow">Lernen planen</div><h1 style={{ fontSize: "2.5rem" }}>Prüfungsplaner</h1>
    {status && <div className="notice" role="status">{status === "saved" ? "Gespeichert." : status === "invalid" ? "Bitte Eingaben prüfen." : "Speichern fehlgeschlagen. Prüfe Datenbankmigration und Berechtigungen."}</div>}
    {!student && <form className="card" action={createExam}><h2>Klassenarbeit eintragen</h2><label className="field">Klasse<select name="classId" required defaultValue=""><option value="" disabled>Klasse auswählen</option>{classesResult.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field">Fach<input name="subject" required maxLength={100}/></label><label className="field">Titel<input name="title" required maxLength={160}/></label><label className="field">Termin<input name="startsAt" type="datetime-local" required/></label><button className="button">Prüfung speichern</button></form>}
    {exams.length === 0 && <article className="card"><p>Keine kommenden Prüfungen eingetragen.</p></article>}
    {exams.map((exam) => {
      const days = Math.max(0, Math.ceil((new Date(exam.starts_at).getTime() - Date.now()) / 86400000));
      const items = checklist.filter((item) => item.exam_id === exam.id);
      return <article className="card" key={exam.id}><div className="eyebrow">{exam.subject}</div><h2>{exam.title}</h2><p>{days === 0 ? "Heute" : `In ${days} Tagen`} · {new Date(exam.starts_at).toLocaleString("de-DE")}</p>
        {student && <><form action={saveExamNote}><input type="hidden" name="examId" value={exam.id}/><label className="field">Deine Lernnotizen<textarea name="note" rows={3} maxLength={5000} defaultValue={notes.get(exam.id) ?? ""}/></label><button className="button secondary">Notiz speichern</button></form>
        <h3>Lern-Checkliste</h3>{items.map((item) => <form action={toggleChecklistItem} className="check-row" key={item.id}><input type="hidden" name="itemId" value={item.id}/><input type="hidden" name="done" value={String(!item.is_done)}/><button className="button secondary" aria-label="Checkliste aktualisieren">{item.is_done ? "✓" : "○"} {item.label}</button></form>)}<form action={addExamChecklistItem}><input type="hidden" name="examId" value={exam.id}/><label className="field">Lernschritt hinzufügen<input name="label" required maxLength={200}/></label><button className="button secondary">Hinzufügen</button></form></>}
      </article>;
    })}
  </main>;
}
