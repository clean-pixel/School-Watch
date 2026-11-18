import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherAiChat, type TeacherChat } from "./teacher-ai-chat";

export default async function TeacherAiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("role,school_id,registration_status")
    .eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "teacher" || profile.registration_status !== "approved" || !profile.school_id) {
    redirect("/dashboard");
  }

  const { data: assignments, error: assignmentError } = await supabase.from("teacher_assignments")
    .select("class_id,subject")
    .eq("school_id", profile.school_id)
    .eq("teacher_id", user.id)
    .order("subject");
  const uniqueAssignments = [...new Map((assignments ?? [])
    .filter((item) => !!item.subject)
    .map((item) => [item.class_id + ":" + item.subject, item])).values()];
  const classIds = [...new Set(uniqueAssignments.map((item) => item.class_id))];

  const classResult = classIds.length
    ? await supabase.from("classes").select("id,name,grade").eq("school_id", profile.school_id).in("id", classIds)
    : { data: [] as { id: string; name: string; grade: string | null }[] };
  const classes = new Map((classResult.data ?? []).map((item) => [item.id, item]));

  // Create one permanent starter conversation for every class/subject assignment.
  // Additional conversations can be created by the teacher from inside the chat.
  for (const assignment of uniqueAssignments) {
    const existing = await supabase.from("teacher_ai_chats").select("id")
      .eq("teacher_id", user.id).eq("class_id", assignment.class_id)
      .eq("subject", assignment.subject!).eq("is_default", true).maybeSingle();
    if (!existing.data && !existing.error) {
      const classInfo = classes.get(assignment.class_id);
      if (classInfo) {
        await supabase.from("teacher_ai_chats").insert({
          school_id: profile.school_id,
          class_id: assignment.class_id,
          teacher_id: user.id,
          subject: assignment.subject!,
          title: assignment.subject! + " · " + classInfo.name,
          is_default: true,
        });
      }
    }
  }

  const chatResult = await supabase.from("teacher_ai_chats")
    .select("id,title,subject,class_id,created_at,is_default")
    .eq("teacher_id", user.id).eq("school_id", profile.school_id)
    .order("created_at", { ascending: false }).limit(100);
  const chats: TeacherChat[] = (chatResult.data ?? []).map((chat) => {
    const classInfo = classes.get(chat.class_id);
    return {
      id: chat.id,
      title: chat.title,
      subject: chat.subject,
      classId: chat.class_id,
      className: classInfo?.name ?? "Klasse",
      grade: classInfo?.grade ?? null,
      createdAt: chat.created_at,
      isDefault: chat.is_default,
    };
  }).sort((a, b) => a.className.localeCompare(b.className, "de") || a.subject.localeCompare(b.subject, "de"));

  return <main className="container teacher-ai-page">
    <header className="topbar">
      <Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link>
      <Link href="/dashboard">← Übersicht</Link>
    </header>
    <div className="eyebrow">Unterrichts-Copilot</div>
    <h1 style={{ fontSize: "2.7rem" }}>Lehrer-KI</h1>
    <p>Ein eigener Chat für jedes Fach und jede Klasse, in der du eingetragen bist. Plane Unterricht, entwickle Arbeitsblätter, erstelle Lernzielkontrollen und überarbeite deine Materialien.</p>
    {assignmentError && <div className="notice" role="alert">Deine Fachzuordnungen konnten nicht geladen werden. Bitte prüfe deine Verbindung.</div>}
    {chats.length === 0 ? <section className="card">
      <h2>Noch keine Fach-Chats</h2>
      <p>Sobald die Schulleitung dich einer Klasse und einem Fach zugeordnet hat, werden hier automatisch passende Chats angelegt. Du musst nichts manuell einrichten.</p>
      <Link className="button secondary" href="/dashboard/teachers">Zu den Lehrkraft-Zuordnungen</Link>
    </section> : <TeacherAiChat initialChats={chats} />}
    <p className="ai-privacy-note">Bitte gib keine Schülernamen, Gesundheitsdaten, Notenlisten mit Klarnamen oder sonstigen vertraulichen Angaben in die KI ein. Prüfe alle KI-Entwürfe vor dem Einsatz.</p>
  </main>;
}
