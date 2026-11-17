import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateTeacherSubjects, assignTeacherToClass } from "@/app/dashboard/actions";

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "school_admin" || profile.registration_status !== "approved" || !profile.school_id) redirect("/dashboard");

  const [teacherResult, classResult, subjectResult] = await Promise.all([
    supabase.from("teachers").select("id,subjects").eq("school_id", profile.school_id).order("id"),
    supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).order("name"),
    supabase.from("class_subjects").select("class_id,subject").eq("school_id", profile.school_id).order("subject"),
  ]);
  const teachers = teacherResult.data ?? [];
  const classes = classResult.data ?? [];
  const namesResult = teachers.length
    ? await supabase.from("profiles").select("id,display_name,registration_status").in("id", teachers.map((item) => item.id))
    : { data: [] as { id: string; display_name: string | null; registration_status: string }[] };
  const names = new Map((namesResult.data ?? []).map((item) => [item.id, item]));
  const statusMessages: Record<string,string> = {
    saved: "Fachzuordnung gespeichert.",
    assigned: "Lehrkraft der Klasse und dem Fach zugeordnet.",
    "teacher-subject": "Diese Lehrkraft ist für das gewählte Fach noch nicht eingetragen.",
    invalid: "Bitte prüfe deine Eingaben.",
    error: "Speichern fehlgeschlagen. Prüfe die Schulzuordnung und Berechtigungen.",
  };

  return <main className="container">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">← Übersicht</Link></header>
    <div className="eyebrow">Schulverwaltung</div>
    <h1 style={{fontSize:"2.7rem"}}>Lehrkräfte & Fächer</h1>
    <p>Trage ein, welche Fächer jede Lehrkraft unterrichtet. Nur diese Fächer können ihr anschließend im Stundenplan zugewiesen werden.</p>
    {status && <div className="notice" role="status">{statusMessages[status] || "Aktion abgeschlossen."}</div>}
    {teacherResult.error && <div className="notice" role="alert">Lehrkräfte konnten nicht geladen werden: {teacherResult.error.message}</div>}
    <section className="section">
      <h2>Fächer der Lehrkräfte</h2>
      {teachers.length === 0 ? <article className="card"><p>Für deine Schule sind noch keine freigegebenen Lehrkräfte vorhanden. Lehrkräfte müssen sich zuerst mit deiner Schule registrieren und von der Schulleitung freigegeben werden.</p></article> :
      <div className="grid">
        {teachers.map((teacher) => {
          const person = names.get(teacher.id);
          return <article className="card" key={teacher.id}>
            <h3>{person?.display_name || "Lehrkraft"}</h3>
            <p>{person?.registration_status === "approved" ? "Freigegeben" : "Freigabe ausstehend"}</p>
            <form action={updateTeacherSubjects}>
              <input type="hidden" name="teacherId" value={teacher.id}/>
              <label className="field">Unterrichtete Fächer (durch Komma trennen)
                <textarea name="subjects" rows={3} maxLength={1600} defaultValue={(teacher.subjects ?? []).join(", ")} placeholder="Deutsch, Mathematik, Englisch" required/>
              </label>
              <button className="button secondary">Fächer speichern</button>
            </form>
          </article>;
        })}
      </div>}
    </section>
    <section className="section">
      <h2>Lehrkraft einer Klasse zuordnen</h2>
      <form action={assignTeacherToClass} className="card formgrid">
        <label className="field">Klasse
          <select name="classId" required defaultValue=""><option value="" disabled>Klasse wählen</option>{classes.map((item)=><option key={item.id} value={item.id}>{item.name}{item.grade ? " · Jahrgang "+item.grade : ""}</option>)}</select>
        </label>
        <label className="field">Lehrkraft
          <select name="teacherId" required defaultValue=""><option value="" disabled>Lehrkraft wählen</option>{teachers.filter((teacher)=>names.get(teacher.id)?.registration_status==="approved").map((teacher)=><option key={teacher.id} value={teacher.id}>{names.get(teacher.id)?.display_name || "Lehrkraft"} · {(teacher.subjects ?? []).join(", ") || "Noch keine Fächer"}</option>)}</select>
        </label>
        <label className="field">Fach (muss in der gewählten Klasse hinterlegt sein)
          <input name="subject" required maxLength={100} placeholder="z. B. Mathematik"/>
        </label>
        <div className="full"><button className="button">Zuordnung speichern</button></div>
      </form>
    </section>
    <p>Die Schulleitung trägt anschließend im <Link href="/dashboard/timetable">Stundenplan</Link> für jede Stunde die zuständige Lehrkraft ein.</p>
  </main>;
}
