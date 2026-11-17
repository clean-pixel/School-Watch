import { createClient } from "@/lib/supabase/server";
import { RegistrationForm, type RegistrationRole, type SchoolOption } from "./registration-form";

export const dynamic = "force-dynamic";

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ rolle?: string }> }) {
  const { rolle } = await searchParams;
  const initialRole: RegistrationRole = rolle === "schule" || rolle === "lehrer" ? rolle : "schueler";
  let schools: SchoolOption[] = [];
  let setupError = "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    setupError = "Die Supabase-Umgebungsvariablen fehlen. Benötigt werden NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (alternativ NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  } else {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("available_schools");
      if (error) setupError = `Supabase meldet: ${error.message}`;
      else schools = (data ?? []) as SchoolOption[];
    } catch (cause) {
      setupError = cause instanceof Error ? cause.message : "Unbekannter Supabase-Verbindungsfehler.";
    }
  }

  return <RegistrationForm schools={schools} initialRole={initialRole} setupError={setupError} />;
}
