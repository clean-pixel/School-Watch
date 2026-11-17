"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function reviewSchoolRegistration(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const validRequestId = z.string().uuid().safeParse(requestId);
  if (!validRequestId.success || !["approve", "reject"].includes(decision)) {
    redirect("/admin?error=invalid");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "platform_admin") redirect("/dashboard");

  const procedure = decision === "approve"
    ? "approve_school_registration"
    : "reject_school_registration";
  const { error } = await supabase.rpc(procedure, { p_request_id: validRequestId.data });
  if (error) redirect("/admin?error=review");

  revalidatePath("/admin");
  redirect(`/admin?success=${decision}`);
}


export async function reviewBugReport(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const validId = z.string().uuid().safeParse(reportId);
  if (!validId.success || !["approve", "reject"].includes(decision)) {
    redirect("/admin/bugs?status=error");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "platform_admin") redirect("/dashboard");

  const accepted = decision === "approve";
  const { data: updated, error } = await supabase.from("bug_reports")
    .update({
      status: accepted ? "accepted" : "rejected",
      reward_points: accepted ? 25 : 0,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", validId.data)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !updated) redirect("/admin/bugs?status=error");

  revalidatePath("/admin/bugs");
  revalidatePath("/dashboard/bugs");
  redirect("/admin/bugs?status=" + (accepted ? "approved" : "rejected"));
}
