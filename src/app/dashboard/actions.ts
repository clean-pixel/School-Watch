"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const classInput = z.object({ name: z.string().trim().min(1).max(80), grade: z.string().trim().max(40).optional() });
const homeworkInput = z.object({ classId: z.string().uuid(), subject: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(4000), dueAt: z.string().datetime() });
const announcementInput = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(5000) });
const eventInput = z.object({ title: z.string().trim().min(1).max(160), description: z.string().trim().max(4000).optional(), startsAt: z.string().datetime() });
const timetableInput = z.object({ classId: z.string().uuid(), weekday: z.coerce.number().int().min(1).max(7), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), subject: z.string().trim().min(1).max(100), room: z.string().trim().max(80).optional() }).refine((value) => value.endsAt > value.startsAt);
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
  const { supabase, profile, user } = await authorized(["teacher", "school_admin"]);
  const parsed = homeworkInput.safeParse({ classId: value(formData, "classId"), subject: value(formData, "subject"), description: value(formData, "description"), dueAt: dateValue(formData, "dueAt") });
  if (!parsed.success) redirect("/dashboard/homework?status=invalid");
  const { error } = await supabase.from("homework").insert({ school_id: profile.school_id, teacher_id: user.id, class_id: parsed.data.classId, subject: parsed.data.subject, description: parsed.data.description, due_at: parsed.data.dueAt });
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
  const { supabase, profile } = await authorized(["teacher", "school_admin"]);
  const parsed = timetableInput.safeParse({ classId: value(formData, "classId"), weekday: value(formData, "weekday"), startsAt: value(formData, "startsAt"), endsAt: value(formData, "endsAt"), subject: value(formData, "subject"), room: value(formData, "room") });
  if (!parsed.success) redirect("/dashboard/timetable?status=invalid");
  const { data: existingTimetable, error: lookupError } = await supabase
    .from("timetables")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("class_id", parsed.data.classId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (lookupError) redirect("/dashboard/timetable?status=error");

  let timetableId = existingTimetable?.id;
  if (!timetableId) {
    const { data: createdTimetable, error: createError } = await supabase
      .from("timetables")
      .insert({ school_id: profile.school_id, class_id: parsed.data.classId, name: "Stundenplan" })
      .select("id")
      .single();
    if (createError || !createdTimetable) redirect("/dashboard/timetable?status=error");
    timetableId = createdTimetable.id;
  }

  const { error } = await supabase.from("timetable_entries").insert({
    school_id: profile.school_id,
    timetable_id: timetableId,
    weekday: parsed.data.weekday,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    subject: parsed.data.subject,
    room: parsed.data.room || null
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
  if (!classId.success || !teacherId.success) redirect("/dashboard/classes?status=invalid");

  const [classRow, teacherRow] = await Promise.all([
    supabase.from("classes").select("id").eq("id", classId.data).eq("school_id", profile.school_id).maybeSingle(),
    supabase.from("teachers").select("id").eq("id", teacherId.data).eq("school_id", profile.school_id).maybeSingle(),
  ]);
  if (!classRow.data || !teacherRow.data || classRow.error || teacherRow.error) redirect("/dashboard/classes?status=invalid");

  const existing = await supabase.from("teacher_assignments").select("id").eq("class_id", classId.data).eq("teacher_id", teacherId.data).maybeSingle();
  if (existing.error) redirect("/dashboard/classes?status=error");
  if (!existing.data) {
    const { error } = await supabase.from("teacher_assignments").insert({
      school_id: profile.school_id,
      class_id: classId.data,
      teacher_id: teacherId.data,
    });
    if (error) redirect("/dashboard/classes?status=error");
  }
  redirect("/dashboard/classes?status=assigned");
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
