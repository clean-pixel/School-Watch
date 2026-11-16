"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function reviewSchoolRegistration(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!requestId || !["approve", "reject"].includes(decision)) {
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
  const { error } = await supabase.rpc(procedure, { p_request_id: requestId });
  if (error) redirect("/admin?error=review");

  revalidatePath("/admin");
  redirect(`/admin?success=${decision}`);
}
