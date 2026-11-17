import { RegistrationForm } from "./registration-form";
import { createClient } from "@/lib/supabase/server";

type SchoolOption = { id: string; name: string; city: string };

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ rolle?: string }> }) {
  const { rolle } = await searchParams;
  const initialRole = rolle === "schule" || rolle === "lehrer" ? rolle : "schueler";
  let schools: SchoolOption[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("available_schools");
    if (!error && data) schools = data as SchoolOption[];
  } catch {
    // The form stays usable to register the first school before Supabase is configured.
  }
  return <RegistrationForm schools={schools} initialRole={initialRole} />;
}
