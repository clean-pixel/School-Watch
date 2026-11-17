import { createClient } from "@/lib/supabase/server";
import { RegistrationForm, type RegistrationRole, type SchoolOption } from "./registration-form";

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ rolle?: string }> }) {
  const { rolle } = await searchParams;
  const initialRole: RegistrationRole = rolle === "schule" || rolle === "lehrer" ? rolle : "schueler";
  let schools: SchoolOption[] = [];
  let setupError = false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("available_schools");
    if (error) setupError = true;
    else schools = (data ?? []) as SchoolOption[];
  } catch {
    setupError = true;
  }

  return <RegistrationForm schools={schools} initialRole={initialRole} setupError={setupError} />;
}
