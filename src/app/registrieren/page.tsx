import { RegistrationForm } from "./registration-form";

type RegistrationPageProps = {
  searchParams: Promise<{ rolle?: string }>;
};

export default async function RegistrationPage({ searchParams }: RegistrationPageProps) {
  const { rolle } = await searchParams;
  const initialRole = rolle === "lehrer" || rolle === "schule" ? rolle : "schueler";
  return <RegistrationForm initialRole={initialRole} />;
}
