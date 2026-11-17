import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentTutor } from "./student-tutor";

export default async function LearningPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "student" || profile.registration_status !== "approved" || !profile.school_id) redirect("/dashboard");

  const { data: memberships } = await supabase.from("class_memberships").select("class_id").eq("student_id", user.id);
  const classIds = (memberships ?? []).map((item) => item.class_id);
  const homeworkResult = classIds.length
    ? await supabase.from("homework").select("id,subject,description,learning_scope,due_at").in("class_id", classIds).order("due_at")
    : { data: [] };
  const tasks = (homeworkResult.data ?? []).map((item) => ({
    ...item,
    learning_scope: item.learning_scope || "",
  }));

  return <main className="container">
    <header className="topbar"><Link className="brand" href="/dashboard"><span className="brand-mark">S</span> SchulWatch One</Link><Link href="/dashboard">← Übersicht</Link></header>
    <div className="eyebrow">Lernhilfe</div>
    <h1 style={{fontSize:"2.7rem"}}>Dein KI-Lerncoach</h1>
    <p>Der Coach orientiert sich an deinen echten Hausaufgaben, dem Thema und den Lernzielen deiner Lehrkraft. Er hilft dir, selbst auf die Lösung zu kommen.</p>
    <StudentTutor tasks={tasks} />
  </main>;
}
