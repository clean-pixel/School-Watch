"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const examSchema = z.object({ classId: z.string().uuid(), subject: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(160), startsAt: z.string().datetime() });
const scheduleSchema = z.object({ classId: z.string().uuid(), type: z.enum(["cancelled", "room", "teacher", "rescheduled"]), title: z.string().trim().min(1).max(160), details: z.string().trim().max(2000), appliesAt: z.string().datetime() });
const text = (form: FormData, key: string) => String(form.get(key) ?? "");
function dateValue(form: FormData, key: string) {
  const raw = text(form, key);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function getActor(roles: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  const { data: profile } = await supabase.from("profiles").select("id,role,school_id,registration_status").eq("id", user.id).maybeSingle();
  if (!profile || !roles.includes(profile.role) || profile.registration_status !== "approved" || !profile.school_id) redirect("/dashboard?fehler=keine-berechtigung");
  return { supabase, user, profile };
}

export async function createExam(form: FormData) {
  const { supabase, user, profile } = await getActor(["teacher", "school_admin"]);
  const parsed = examSchema.safeParse({ classId: text(form, "classId"), subject: text(form, "subject"), title: text(form, "title"), startsAt: dateValue(form, "startsAt") });
  if (!parsed.success) redirect("/dashboard/pruefungsplaner?status=invalid");
  const { error } = await supabase.from("exams").insert({ school_id: profile.school_id, class_id: parsed.data.classId, subject: parsed.data.subject, title: parsed.data.title, starts_at: parsed.data.startsAt, created_by: user.id });
  redirect(`/dashboard/pruefungsplaner?status=${error ? "error" : "saved"}`);
}

export async function saveExamNote(form: FormData) {
  const { supabase, user } = await getActor(["student"]);
  const examId = z.string().uuid().safeParse(text(form, "examId"));
  const note = z.string().trim().max(5000).safeParse(text(form, "note"));
  if (!examId.success || !note.success) redirect("/dashboard/pruefungsplaner?status=invalid");
  const { error } = await supabase.from("exam_study_notes").upsert({ exam_id: examId.data, student_id: user.id, note: note.data, updated_at: new Date().toISOString() }, { onConflict: "exam_id,student_id" });
  redirect(`/dashboard/pruefungsplaner?status=${error ? "error" : "saved"}`);
}

export async function addExamChecklistItem(form: FormData) {
  const { supabase, user } = await getActor(["student"]);
  const examId = z.string().uuid().safeParse(text(form, "examId"));
  const label = z.string().trim().min(1).max(200).safeParse(text(form, "label"));
  if (!examId.success || !label.success) redirect("/dashboard/pruefungsplaner?status=invalid");
  const { error } = await supabase.from("exam_checklist_items").insert({ exam_id: examId.data, student_id: user.id, label: label.data });
  redirect(`/dashboard/pruefungsplaner?status=${error ? "error" : "saved"}`);
}

export async function toggleChecklistItem(form: FormData) {
  const { supabase, user } = await getActor(["student"]);
  const id = z.string().uuid().safeParse(text(form, "itemId"));
  const done = text(form, "done") === "true";
  if (!id.success) redirect("/dashboard/pruefungsplaner?status=invalid");
  const { error } = await supabase.from("exam_checklist_items").update({ is_done: done }).eq("id", id.data).eq("student_id", user.id);
  redirect(`/dashboard/pruefungsplaner?status=${error ? "error" : "saved"}`);
}

export async function createScheduleChange(form: FormData) {
  const { supabase, user, profile } = await getActor(["teacher", "school_admin"]);
  const rawTime = text(form, "appliesAt");
  const parsed = scheduleSchema.safeParse({ classId: text(form, "classId"), type: text(form, "type"), title: text(form, "title"), details: text(form, "details"), appliesAt: dateValue(form, "appliesAt") });
  if (!parsed.success) redirect("/dashboard/kalender?status=invalid");
  const { error } = await supabase.from("schedule_changes").insert({ school_id: profile.school_id, class_id: parsed.data.classId, changed_by: user.id, change_type: parsed.data.type, title: parsed.data.title, details: parsed.data.details, applies_at: parsed.data.appliesAt });
  redirect(`/dashboard/kalender?status=${error ? "error" : "saved"}`);
}

export async function saveDashboardWidgets(form: FormData) {
  const { supabase, user } = await getActor(["student"]);
  const allowed = new Set(["timetable", "homework", "exams", "messages", "calendar", "announcements"]);
  const widgets = form.getAll("widgets").map(String).filter((widget) => allowed.has(widget));
  const { error } = await supabase.from("student_dashboard_preferences").upsert({ student_id: user.id, widgets, updated_at: new Date().toISOString() }, { onConflict: "student_id" });
  redirect(`/dashboard?status=${error ? "error" : "saved"}`);
}

export async function saveFocusSession(form: FormData) {
  const { supabase, user } = await getActor(["student"]);
  const focusMinutes = z.coerce.number().int().min(5).max(180).safeParse(text(form, "focusMinutes"));
  const breakMinutes = z.coerce.number().int().min(1).max(60).safeParse(text(form, "breakMinutes"));
  if (!focusMinutes.success || !breakMinutes.success) redirect("/dashboard/focus?status=invalid");
  const { error } = await supabase.from("focus_sessions").insert({ student_id: user.id, focus_minutes: focusMinutes.data, break_minutes: breakMinutes.data });
  redirect(`/dashboard/focus?status=${error ? "error" : "saved"}`);
}
