import { RegistrationForm } from "./registration-form";
import { createClient } from "@/lib/supabase/server";

type SchoolOption = { id: string; name: string; city: string };

export default async function RegistrationPage() {
  let schools: SchoolOption[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("available_schools");
    schools = (data ?? []) as SchoolOption[];
  } catch {
    // Registration stays visible while Supabase configuration is being completed.
  }
  return <RegistrationForm schools={schools} />;
}
