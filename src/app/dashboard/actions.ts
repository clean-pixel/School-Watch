"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const classInput = z.object({ name: z.string().trim().min(1).max(80), grade: z.string().trim().max(40).optional() });
const homeworkInput = z.object({ classId: z.string().uuid(), subject: z.string().trim().min(1).max(100), learningScope: z.string().trim().max(1000).optional(), description: z.string().trim().min(1).max(4000), dueAt: z.string().datetime() });
const announcementInput = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000) });
const eventInput = z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().max(4000).optional(), startsAt: z.string().datetime() });
const timetableInput = z.object({ classId: z.string().uuid(), weekday: z.coerce.number().int().min(1).max(5), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), subject: z.string().trim().min(1).max(100), room: z.string().trim().max(80).optional(), teacherId: z.string().uuid().optional(), weekType: z.enum(["both", "A", "B"]).default("both") }).refine((value) => value.endsAt > value.startsAt);
const messageInput = z.object({ recipientId: z.string().uuid(), subject: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000) });

async function authorized(roles: string[], requireSchool = true) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("id,role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || !roles.includes(profile.role) || profile.registration_status !== "approved" || (requireSchool && !profile.school_id)) redirect("/dashboard?fehler=keine-berechtigung");
  return { supabase, user, profile };
}
const value = (formData: FormData, key: string) => String(formData.get(key) ?? "");
function dateValue(formData: FormData, key: string) { const date = new Date(value(formData, key)); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }

export async function createClass(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  const parsed = classInput.safeParse({ name: value(formData, "name"), grade: value(formData, "grade") });
  if (!parsed.success) redirect("/dashboard/classes?status=invalid");
  const { data: created, error } = await supabase.from("classes").insert({ school_id: profile.school_id, name: parsed.data.name, grade: parsed.data.grade || null }).select("id").single();
  if (error || !created) redirect("/dashboard/classes?status=error");
  redirect("/dashboard/classes?status=saved");
}

export async function createHomework(formData: FormData) {
  const { supabase, profile, user } = await authorized(["teacher"]);
  const parsed = homeworkInput.safeParse({
    classId: value(formData, "classId"),
    subject: value(formData, "subject"),
    learningScope: value(formData, "learningScope"),
    description: value(formData, "description"),
    dueAt: dateValue(formData, "dueAt"),
  });
  if (!parsed.success) redirect("/dashboard/homework?status=invalid");

  const { data: assignment, error: assignmentError } = await supabase.from("teacher_assignments")
    .select("id").eq("school_id", profile.school_id).eq("class_id", parsed.data.classId)
    .eq("teacher_id", user.id).eq("subject", parsed.data.subject).maybeSingle();
  if (assignmentError || !assignment) redirect("/dashboard/homework?status=not-assigned");

  const { error } = await supabase.from("homework").insert({
    school_id: profile.school_id,
    teacher_id: user.id,
    class_id: parsed.data.classId,
    subject: parsed.data.subject,
    learning_scope: parsed.data.learningScope || "",
    description: parsed.data.description,
    due_at: parsed.data.dueAt,
  });
  redirect(`/dashboard/homework?status=${error ? "error" : "saved"}`);
}

export async function createAnnouncement(formData: FormData) {
  const { supabase, profile, user } = await authorized(["teacher", "school_admin"]);
  const parsed = announcementInput.safeParse({ title: value(formData, "title"), body: value(formData, "body") });
  if (!parsed.success) redirect("/dashboard/announcements?status=invalid");
  const { error } = await supabase.from("announcements").insert({ school_id: profile.school_id, author_id: user.id, title: parsed.data.title, body: parsed.data.body, published_at: new Date().toISOString() });
  redirect(`/dashboard/announcements?status=${error ? "error" : "saved"}`);
}
export async function createEvent(formData: FormData) {
  const { supabase, profile, user } = await authorized(["teacher", "school_admin"]);
  const parsed = eventInput.safeParse({ title: value(formData, "title"), description: value(formData, "description"), startsAt: dateValue(formData, "startsAt") });
  if (!parsed.success) redirect("/dashboard/events?status=invalid");
  const { error } = await supabase.from("school_events").insert({ school_id: profile.school_id, created_by: user.id, title: parsed.data.title, description: parsed.data.description || null, starts_at: parsed.data.startsAt });
  redirect(`/dashboard/events?status=${error ? "error" : "saved"}`);
}
export async function createTimetableEntry(formData: FormData) {
  const { supabase, profile, user } = await authorized(["teacher", "school_admin"]);
  const parsed = timetableInput.safeParse({
    classId: value(formData, "classId"), weekday: value(formData, "weekday"),
    startsAt: value(formData, "startsAt"), endsAt: value(formData, "endsAt"),
    subject: value(formData, "subject"), room: value(formData, "room"),
    teacherId: value(formData, "teacherId") || undefined,
    weekType: value(formData, "weekType") || "both",
  });
  if (!parsed.success) redirect("/dashboard/timetable?status=invalid");

  const { data: classRow, error: classError } = await supabase.from("classes")
    .select("id").eq("id", parsed.data.classId).eq("school_id", profile.school_id).maybeSingle();
  if (classError || !classRow) redirect("/dashboard/timetable?status=invalid");

  const teacherId = profile.role === "teacher" ? user.id : parsed.data.teacherId;
  if (!teacherId) redirect("/dashboard/timetable?status=teacher-required");
  if (profile.role === "teacher" && parsed.data.teacherId && parsed.data.teacherId !== user.id) {
    redirect("/dashboard/timetable?status=teacher-subject");
  }

  const { data: teacher, error: teacherError } = await supabase.from("teachers")
    .select("id,subjects").eq("id", teacherId).eq("school_id", profile.school_id).maybeSingle();
  if (teacherError || !teacher || !(teacher.subjects ?? []).includes(parsed.data.subject)) {
    redirect("/dashboard/timetable?status=teacher-subject");
  }

  const { data: assignment, error: assignmentError } = await supabase.from("teacher_assignments")
    .select("id").eq("school_id", profile.school_id).eq("class_id", parsed.data.classId)
    .eq("teacher_id", teacherId).eq("subject", parsed.data.subject).maybeSingle();
  if (assignmentError || !assignment) redirect("/dashboard/timetable?status=teacher-subject");

  const { data: existingTimetable, error: lookupError } = await supabase.from("timetables")
    .select("id").eq("school_id", profile.school_id).eq("class_id", parsed.data.classId)
    .order("created_at").limit(1).maybeSingle();
  if (lookupError) redirect("/dashboard/timetable?status=error");

  let timetableId = existingTimetable?.id;
  if (!timetableId) {
    const { data: createdTimetable, error: createError } = await supabase.from("timetables")
      .insert({ school_id: profile.school_id, class_id: parsed.data.classId, name: "Stundenplan" })
      .select("id").single();
    if (createError || !createdTimetable) redirect("/dashboard/timetable?status=error");
    timetableId = createdTimetable.id;
  }

  const [classEntries, teacherEntries] = await Promise.all([
    supabase.from("timetable_entries").select("id,starts_at,ends_at,week_type")
      .eq("school_id", profile.school_id).eq("timetable_id", timetableId).eq("weekday", parsed.data.weekday),
    supabase.from("timetable_entries").select("id,starts_at,ends_at,week_type")
      .eq("school_id", profile.school_id).eq("teacher_id", teacherId).eq("weekday", parsed.data.weekday),
  ]);
  if (classEntries.error || teacherEntries.error) redirect("/dashboard/timetable?status=error");

  const overlaps = (entry: { id: string; starts_at: string; ends_at: string; week_type: string }) => {
    const weekOverlap = parsed.data.weekType === "both" || entry.week_type === "both" || parsed.data.weekType === entry.week_type;
    const timeOverlap = parsed.data.startsAt < entry.ends_at.slice(0, 5) && parsed.data.endsAt > entry.starts_at.slice(0, 5);
    return weekOverlap && timeOverlap;
  };
  if ((classEntries.data ?? []).some(overlaps)) redirect("/dashboard/timetable?status=class-conflict");
  if ((teacherEntries.data ?? []).some(overlaps)) redirect("/dashboard/timetable?status=teacher-conflict");

  const { error } = await supabase.from("timetable_entries").insert({
    school_id: profile.school_id, timetable_id: timetableId, weekday: parsed.data.weekday,
    starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt, subject: parsed.data.subject,
    room: parsed.data.room || null, teacher_id: teacherId, week_type: parsed.data.weekType,
  });
  redirect(`/dashboard/timetable?status=${error ? "error" : "saved"}`);
}
export async function sendSchoolMessage(formData: FormData) {
  const { supabase } = await authorized(["teacher", "school_admin"]);
  const parsed = messageInput.safeParse({ recipientId: value(formData, "recipientId"), subject: value(formData, "subject"), body: value(formData, "body") });
  if (!parsed.success) redirect("/dashboard/messages?status=invalid");
  const { error } = await supabase.rpc("send_school_message", {
    p_recipient_id: parsed.data.recipientId,
    p_subject: parsed.data.subject,
    p_body: parsed.data.body,
  });
  redirect(`/dashboard/messages?status=${error ? "error" : "saved"}`);
}
export async function assignStudentToClass(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  const classId = z.string().uuid().safeParse(value(formData, "classId"));
  const studentId = z.string().uuid().safeParse(value(formData, "studentId"));
  if (!classId.success || !studentId.success) redirect("/dashboard/classes?status=invalid");

  const [classRow, studentRow] = await Promise.all([
    supabase.from("classes").select("id").eq("id", classId.data).eq("school_id", profile.school_id).maybeSingle(),
    supabase.from("students").select("id").eq("id", studentId.data).eq("school_id", profile.school_id).maybeSingle(),
  ]);
  if (!classRow.data || !studentRow.data || classRow.error || studentRow.error) redirect("/dashboard/classes?status=invalid");

  const existing = await supabase.from("class_memberships").select("id").eq("class_id", classId.data).eq("student_id", studentId.data).maybeSingle();
  if (existing.error) redirect("/dashboard/classes?status=error");
  if (!existing.data) {
    const { error } = await supabase.from("class_memberships").insert({
      school_id: profile.school_id,
      class_id: classId.data,
      student_id: studentId.data,
    });
    if (error) redirect("/dashboard/classes?status=error");
  }
  redirect("/dashboard/classes?status=assigned");
}

export async function assignTeacherToClass(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  const classId = z.string().uuid().safeParse(value(formData, "classId"));
  const teacherId = z.string().uuid().safeParse(value(formData, "teacherId"));
  if (!classId.success || !teacherId.success) redirect("/dashboard/teachers?status=invalid");

  const [classRow, teacherRow] = await Promise.all([
    supabase.from("classes").select("id").eq("id", classId.data).eq("school_id", profile.school_id).maybeSingle(),
    supabase.from("teachers").select("id").eq("id", teacherId.data).eq("school_id", profile.school_id).maybeSingle(),
  ]);
  if (!classRow.data || !teacherRow.data || classRow.error || teacherRow.error) redirect("/dashboard/teachers?status=invalid");

  const subject = value(formData, "subject").trim();
  if (!subject) redirect("/dashboard/teachers?status=invalid");
  const [teacherSubjects, classSubject] = await Promise.all([
    supabase.from("teachers").select("subjects").eq("id", teacherId.data).eq("school_id", profile.school_id).maybeSingle(),
    supabase.from("class_subjects").select("class_id").eq("school_id", profile.school_id).eq("class_id", classId.data).eq("subject", subject).maybeSingle(),
  ]);
  if (teacherSubjects.error || !teacherSubjects.data || !(teacherSubjects.data.subjects ?? []).includes(subject) || classSubject.error || !classSubject.data) {
    redirect("/dashboard/teachers?status=teacher-subject");
  }

  const existingQuery = supabase.from("teacher_assignments").select("id").eq("class_id", classId.data).eq("teacher_id", teacherId.data);
  const existing = subject ? await existingQuery.eq("subject", subject).maybeSingle() : await existingQuery.is("subject", null).maybeSingle();
  if (existing.error) redirect("/dashboard/teachers?status=error");
  if (!existing.data) {
    const { error } = await supabase.from("teacher_assignments").insert({
      school_id: profile.school_id,
      class_id: classId.data,
      teacher_id: teacherId.data,
      subject: subject || null,
    });
    if (error) redirect("/dashboard/teachers?status=error");
  }
  redirect("/dashboard/teachers?status=assigned");
}

export async function reviewTeacher(formData: FormData) {
  const { supabase } = await authorized(["school_admin"]);
  const requestId = z.string().uuid().safeParse(value(formData, "requestId"));
  const decision = value(formData, "decision");
  if (!requestId.success || !["approve", "reject"].includes(decision)) redirect("/dashboard/teachers?status=invalid");
  const { error } = await supabase.rpc("review_teacher_join_request", { p_request_id: requestId.data, p_decision: decision });
  redirect(`/dashboard/teachers?status=${error ? "error" : decision === "approve" ? "approved" : "rejected"}`);
}
export async function approveRegistration(formData: FormData) {
  const { supabase } = await authorized(["platform_admin"], false);
  const id = z.string().uuid().safeParse(value(formData, "requestId"));
  if (!id.success) redirect("/dashboard/platform?status=invalid");
  const { error } = await supabase.rpc("approve_school_registration", { p_request_id: id.data });
  redirect(`/dashboard/platform?status=${error ? "error" : "approved"}`);
}


const subjectList = z.array(z.string().trim().min(1).max(80)).max(20);
export async function updateTeacherSubjects(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  const teacherId = z.string().uuid().safeParse(value(formData, "teacherId"));
  const subjects = subjectList.safeParse(value(formData, "subjects").split(/[;,]/).map((item) => item.trim()).filter(Boolean));
  if (!teacherId.success || !subjects.success) redirect("/dashboard/teachers?status=invalid");
  const teacher = await supabase.from("teachers").select("id").eq("id", teacherId.data).eq("school_id", profile.school_id).maybeSingle();
  if (teacher.error || !teacher.data) redirect("/dashboard/teachers?status=invalid");
  const { error } = await supabase.from("teachers").update({ subjects: [...new Set(subjects.data)] }).eq("id", teacherId.data).eq("school_id", profile.school_id);
  redirect(`/dashboard/teachers?status=${error ? "error" : "saved"}`);
}

export async function createClassSubject(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  const classId = z.string().uuid().safeParse(value(formData, "classId"));
  const subject = z.string().trim().min(1).max(100).safeParse(value(formData, "subject"));
  const periodsA = z.coerce.number().int().min(0).max(30).optional().safeParse(value(formData, "weeklyPeriodsA") || undefined);
  const periodsB = z.coerce.number().int().min(0).max(30).optional().safeParse(value(formData, "weeklyPeriodsB") || undefined);
  if (!classId.success || !subject.success || !periodsA.success || !periodsB.success) redirect("/dashboard/schule-setup?status=invalid");

  const { data: classRow, error: classError } = await supabase.from("classes")
    .select("id").eq("id", classId.data).eq("school_id", profile.school_id).maybeSingle();
  if (classError || !classRow) redirect("/dashboard/schule-setup?status=invalid");

  const { error } = await supabase.from("class_subjects").upsert({
    school_id: profile.school_id,
    class_id: classId.data,
    subject: subject.data,
    weekly_periods_a: periodsA.data ?? null,
    weekly_periods_b: periodsB.data ?? null,
  }, { onConflict: "class_id,subject" });
  redirect(`/dashboard/schule-setup?status=${error ? "error" : "saved"}`);
}

export async function updateSchoolHours(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  const start = z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).safeParse(value(formData, "dayStart"));
  const end = z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/).safeParse(value(formData, "dayEnd"));
  if (!start.success || !end.success || end.data <= start.data) redirect("/dashboard/schule-setup?status=invalid");
  const { data: updated, error } = await supabase.from("schools")
    .update({ day_start_time: start.data, day_end_time: end.data })
    .eq("id", profile.school_id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateSchoolHours] Supabase error code:", error.code);
    redirect(`/dashboard/schule-setup?status=${error.code === "42501" ? "permission" : "error"}`);
  }
  if (!updated) redirect("/dashboard/schule-setup?status=permission");

  revalidatePath("/dashboard/schule-setup");
  redirect("/dashboard/schule-setup?status=saved");
}

export async function applySchoolResearch(formData: FormData) {
  const { supabase, profile } = await authorized(["school_admin"]);
  let raw: unknown;
  try { raw = JSON.parse(value(formData, "research")); } catch { redirect("/dashboard/schule-setup?status=invalid"); }
  const schema = z.object({
    classes: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      grade: z.string().trim().max(40).optional(),
      subjects: z.array(z.string().trim().min(1).max(100)).max(30)
    })).min(1).max(30),
    sources: z.array(z.string().url()).min(1).max(12)
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success || parsed.data.sources.some((source) => !source.startsWith("https://"))) redirect("/dashboard/schule-setup?status=invalid");
  for (const proposed of parsed.data.classes) {
    let classId: string | null = null;
    const existing = await supabase.from("classes").select("id").eq("school_id", profile.school_id).eq("name", proposed.name).maybeSingle();
    if (existing.error) redirect("/dashboard/schule-setup?status=error");
    classId = existing.data?.id ?? null;
    if (!classId) {
      const created = await supabase.from("classes").insert({
        school_id: profile.school_id, name: proposed.name, grade: proposed.grade || null
      }).select("id").single();
      if (created.error || !created.data) redirect("/dashboard/schule-setup?status=error");
      classId = created.data.id;
    }
    const subjects = [...new Set(proposed.subjects.map((subject) => subject.trim()).filter(Boolean))];
    if (subjects.length) {
      const rows = subjects.map((subject) => ({
        school_id: profile.school_id, class_id: classId, subject
      }));
      const { error } = await supabase.from("class_subjects").upsert(rows, { onConflict: "class_id,subject", ignoreDuplicates: true });
      if (error) redirect("/dashboard/schule-setup?status=error");
    }
  }
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/timetable");
  redirect("/dashboard/schule-setup?status=research-saved");
}

export async function moveTimetableEntry(formData: FormData) {
  const { supabase, profile, user } = await authorized(["school_admin", "teacher"]);
  const id = z.string().uuid().safeParse(value(formData, "entryId"));
  const weekday = z.coerce.number().int().min(1).max(5).safeParse(value(formData, "weekday"));
  if (!id.success || !weekday.success) return { success: false, message: "Ungültige Stunde." };

  let entryQuery = supabase.from("timetable_entries")
    .select("id,timetable_id,weekday,starts_at,ends_at,teacher_id,week_type")
    .eq("id", id.data).eq("school_id", profile.school_id);
  if (profile.role === "teacher") entryQuery = entryQuery.eq("teacher_id", user.id);
  const { data: entry, error: entryError } = await entryQuery.maybeSingle();
  if (entryError || !entry) return { success: false, message: "Diese Stunde darfst du nicht bearbeiten." };

  const weeksOverlap = (other: { week_type: string }) =>
    entry.week_type === "both" || other.week_type === "both" || entry.week_type === other.week_type;
  const timesOverlap = (other: { starts_at: string; ends_at: string }) =>
    entry.starts_at.slice(0, 5) < other.ends_at.slice(0, 5) &&
    entry.ends_at.slice(0, 5) > other.starts_at.slice(0, 5);

  const { data: classEntries, error: classError } = await supabase.from("timetable_entries")
    .select("id,starts_at,ends_at,week_type")
    .eq("school_id", profile.school_id).eq("timetable_id", entry.timetable_id)
    .eq("weekday", weekday.data).neq("id", id.data);
  if (classError) return { success: false, message: "Der Stundenplan konnte nicht geprüft werden." };
  if ((classEntries ?? []).some((other) => weeksOverlap(other) && timesOverlap(other))) {
    return { success: false, message: "In dieser Klasse liegt zu dieser Zeit bereits Unterricht." };
  }

  if (entry.teacher_id) {
    const { data: teacherEntries, error: teacherError } = await supabase.from("timetable_entries")
      .select("id,starts_at,ends_at,week_type")
      .eq("school_id", profile.school_id).eq("teacher_id", entry.teacher_id)
      .eq("weekday", weekday.data).neq("id", id.data);
    if (teacherError) return { success: false, message: "Der Lehrkraftplan konnte nicht geprüft werden." };
    if ((teacherEntries ?? []).some((other) => weeksOverlap(other) && timesOverlap(other))) {
      return { success: false, message: "Die Lehrkraft hat zu dieser Zeit bereits Unterricht." };
    }
  }

  const { error } = await supabase.from("timetable_entries")
    .update({ weekday: weekday.data }).eq("id", id.data).eq("school_id", profile.school_id);
  if (error) return { success: false, message: "Die Stunde konnte nicht verschoben werden." };
  revalidatePath("/dashboard/timetable");
  return { success: true };
}
export async function saveLessonWorksheet(formData: FormData) {
  const { supabase, profile, user } = await authorized(["school_admin", "teacher"]);
  const parsed = z.object({
    classId: z.string().uuid(),
    subject: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(160),
    topic: z.string().trim().min(1).max(500),
    content: z.string().trim().min(1).max(20000),
  }).safeParse({
    classId: value(formData, "classId"),
    subject: value(formData, "subject"),
    title: value(formData, "title"),
    topic: value(formData, "topic"),
    content: value(formData, "content"),
  });
  if (!parsed.success) redirect("/dashboard/arbeitsblaetter?status=invalid");
  const { error } = await supabase.from("lesson_worksheets").insert({
    school_id: profile.school_id,
    class_id: parsed.data.classId,
    teacher_id: user.id,
    subject: parsed.data.subject,
    title: parsed.data.title,
    topic: parsed.data.topic,
    content: parsed.data.content,
    is_published: value(formData, "publish") === "true",
  });
  redirect(`/dashboard/arbeitsblaetter?status=${error ? "error" : "saved"}`);
}
