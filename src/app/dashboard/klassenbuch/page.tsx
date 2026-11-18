import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClassbookManager, type ClassbookEntryView } from "./classbook-manager";

type Search = { classId?: string };

export default async function ClassbookPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { classId: requestedClassId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
    redirect("/dashboard");
  }

  const { data: assignments, error: assignmentError } = await supabase.from("teacher_assignments")
    .select("class_id,subject").eq("school_id", profile.school_id).eq("teacher_id", user.id);
  const classIds = [...new Set((assignments ?? []).map((item) => item.class_id))];
  const classResult = classIds.length
    ? await supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).in("id", classIds).order("name")
    : { data: [] as { id: string; name: string; grade: string | null }[] };
  const classes = classResult.data ?? [];
  const selectedClass = classes.find((item) => item.id === requestedClassId) ?? classes[0] ?? null;
  const subjects = selectedClass
    ? [...new Set((assignments ?? []).filter((item) => item.class_id === selectedClass.id).map((item) => item.subject).filter((item): item is string => !!item))].sort((a, b) => a.localeCompare(b, "de"))
    : [];

  let roster: { id: string; name: string }[] = [];
  let entries: ClassbookEntryView[] = [];
  if (selectedClass) {
    const memberships = await supabase.from("class_memberships").select("student_id")
      .eq("school_id", profile.school_id).eq("class_id", selectedClass.id);
    const studentIds = [...new Set((memberships.data ?? []).map((item) => item.student_id))];
    const profiles = studentIds.length
      ? await supabase.from("profiles").select("id,display_name").in("id", studentIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const names = new Map((profiles.data ?? []).map((item) => [item.id, item.display_name || "Schüler/in"]));
    roster = studentIds.map((id) => ({ id, name: names.get(id) ?? "Schüler/in" })).sort((a, b) => a.name.localeCompare(b.name, "de"));

    const entryResult = await supabase.from("classbook_entries")
      .select("id,subject,lesson_date,period,lesson_topic,lesson_content,homework,teacher_notes,created_at")
      .eq("school_id", profile.school_id).eq("class_id", selectedClass.id)
      .eq("teacher_id", user.id)
      .order("lesson_date", { ascending: false }).order("created_at", { ascending: false }).limit(40);
    const entryIds = (entryResult.data ?? []).map((entry) => entry.id);
    const attendanceResult = entryIds.length
      ? await supabase.from("classbook_attendance").select("entry_id,status").in("entry_id", entryIds)
      : { data: [] as { entry_id: string; status: string }[] };
    const attendanceMap = new Map<string, string[]>();
    for (const row of attendanceResult.data ?? []) {
      attendanceMap.set(row.entry_id, [...(attendanceMap.get(row.entry_id) ?? []), row.status]);
    }
    entries = (entryResult.data ?? []).map((entry) => ({
      ...entry,
      attendance: attendanceMap.get(entry.id) ?? [],
    }));
  }

  return <main className="container classbook-page">
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <Link href="/dashboard">← Übersicht</Link>
    </header>
    <div className="eyebrow">Lehrerbereich</div>
    <h1 style={{ fontSize: "2.7rem" }}>Digitales Klassenbuch</h1>
    <p>Dokumentiere Unterrichtsstunden, Themen, Hausaufgaben und Anwesenheit. Deine Einträge sind auf deine zugeordneten Klassen beschränkt.</p>
    {assignmentError && <div className="notice" role="alert">Deine Klassenzuordnungen konnten nicht geladen werden. Bitte prüfe deine Verbindung.</div>}
    {classes.length === 0 ? <section className="card">
      <h2>Noch keine Klasse zugeordnet</h2>
      <p>Sobald die Schulleitung dich einer Klasse und einem Fach zugeordnet hat, kannst du hier Unterricht dokumentieren.</p>
      <Link className="button secondary" href="/dashboard/teachers">Zu den Lehrkraft-Zuordnungen</Link>
    </section> : <ClassbookManager
      classes={classes}
      selectedClassId={selectedClass?.id ?? ""}
      subjects={subjects}
      roster={roster}
      entries={entries}
      today={new Date().toLocaleDateString("sv-SE")}
    />}
    <p className="ai-privacy-note">Bitte notiere hier nur notwendige schulische Informationen. Verwende keine medizinischen Angaben oder unnötigen privaten Details.</p>
  </main>;
}
