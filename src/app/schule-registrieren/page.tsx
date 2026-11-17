import { redirect } from "next/navigation";

export default function SchoolRegistrationPage() {
  redirect("/registrieren?rolle=schule");
}
