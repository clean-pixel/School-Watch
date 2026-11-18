"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reportSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(10).max(3000),
  pagePath: z.string().trim().max(200).optional(),
  severity: z.enum(["low", "normal", "high"]),
});

export async function submitBugReport(formData: FormData) {
  const parsed = reportSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    pagePath: String(formData.get("pagePath") ?? ""),
    severity: String(formData.get("severity") ?? "normal"),
  });

  if (!parsed.success) redirect("/dashboard/bugs?status=invalid");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase.from("profiles")
    .select("registration_status,role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "platform_admin" && profile.registration_status !== "approved")) {
    redirect("/dashboard?fehler=keine-berechtigung");
  }

  const { error } = await supabase.from("bug_reports").insert({
    reporter_id: user.id,
    title: parsed.data.title,
    description: parsed.data.description,
    page_path: parsed.data.pagePath || null,
    severity: parsed.data.severity,
  });

  if (error) redirect("/dashboard/bugs?status=error");

  revalidatePath("/dashboard/bugs");
  revalidatePath("/admin/bugs");
  redirect("/dashboard/bugs?status=submitted");
}
