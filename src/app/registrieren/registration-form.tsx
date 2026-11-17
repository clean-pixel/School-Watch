"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RegistrationRole = "schueler" | "lehrer" | "schule";
type SchoolOption = { id: string; name: string; city: string };

export function RegistrationForm({ schools, initialRole }: { schools: SchoolOption[]; initialRole: RegistrationRole }) {
  const router = useRouter();
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 12) {
      setError("Das Passwort muss mindestens 12 Zeichen enthalten.");
      setBusy(false);
      return;
    }
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Die Passwörter stimmen nicht überein.");
      setBusy(false);
      return;
    }

    const schoolId = String(form.get("schoolId") ?? "");
    if (role !== "schule" && !schools.some((school) => school.id === schoolId)) {
      setError("Bitte wähle eine verfügbare Schule aus.");
      setBusy(false);
      return;
    }

    const metadata: Record<string, string> = {
      registration_type: role === "schule" ? "school" : role === "lehrer" ? "teacher" : "student",
      contact_name: String(form.get("displayName") ?? "").trim(),
    };
    if (role === "schule") {
      metadata.school_name = String(form.get("schoolName") ?? "").trim();
      metadata.school_type = String(form.get("schoolType") ?? "").trim();
      metadata.street = String(form.get("street") ?? "").trim();
      metadata.postal_code = String(form.get("postalCode") ?? "").trim();
      metadata.city = String(form.get("city") ?? "").trim();
      metadata.state = String(form.get("state") ?? "").trim();
    } else {
      metadata.school_id = schoolId;
    }

    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: String(form.get("email") ?? "").trim(),
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
          data: metadata,
        },
      });
      if (signupError) {
        setError("Registrierung fehlgeschlagen. Prüfe deine Angaben und ob die Supabase-Migrationen ausgeführt wurden.");
      } else if (data.session) {
        // When email confirmation is disabled, Supabase has already signed the new user in.
        router.replace("/dashboard");
        router.refresh();
      } else {
        // With email confirmation enabled the new school/profile is created by the DB trigger;
        // the confirmation callback takes the user to their school dashboard.
        setDone(true);
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte prüfe die Supabase-Konfiguration.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>{role === "schule" ? "Schule erstellt" : "Registrierung eingereicht"}</h1>
    <p>{role === "schule"
      ? "Dein Schulkonto ist als Schuladministrator eingerichtet. Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach. Danach wirst du direkt zum Schul-Dashboard weitergeleitet."
      : role === "lehrer"
        ? "Dein Zugang wird erst aktiv, wenn die ausgewählte Schule deine Lehrkraft-Anmeldung bestätigt. Bestätige gegebenenfalls auch deine E-Mail-Adresse."
        : "Dein Schülerkonto wurde erstellt und der ausgewählten Schule zugeordnet. Bestätige gegebenenfalls deine E-Mail-Adresse."}</p>
    <Link className="button" href="/anmelden">Zur Anmeldung</Link>
  </main>;

  return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>Konto erstellen</h1>
    <p>Schul- und Schülerkonten werden direkt eingerichtet. Lehrkräfte werden von ihrer Schule bestätigt.</p>
    {error && <div className="notice" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <label className="field">Ich registriere mich als
        <select value={role} onChange={(event) => setRole(event.target.value as RegistrationRole)}>
          <option value="schueler">Schüler/in</option>
          <option value="lehrer">Lehrkraft</option>
          <option value="schule">Schulleitung / Schule</option>
        </select>
      </label>
      <label className="field">{role === "schule" ? "Name der verantwortlichen Schulleitung" : "Vor- und Nachname"}
        <input required name="displayName" autoComplete="name" maxLength={120} />
      </label>
      {role !== "schule" && <label className="field">Schule
        <select name="schoolId" required defaultValue="">
          <option value="" disabled>Schule auswählen</option>
          {schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.city}</option>)}
        </select>
        {schools.length === 0 && <span>Es gibt noch keine verfügbare Schule. Registriere zuerst eine Schule.</span>}
      </label>}
      {role === "schule" && <>
        <label className="field">Schulname<input required name="schoolName" maxLength={160} /></label>
        <label className="field">Schulart<input required name="schoolType" maxLength={100} /></label>
        <label className="field">Straße und Hausnummer<input required name="street" maxLength={200} /></label>
        <label className="field">Postleitzahl<input required name="postalCode" maxLength={20} /></label>
        <label className="field">Stadt<input required name="city" maxLength={120} /></label>
        <label className="field">Bundesland<input required name="state" maxLength={120} /></label>
      </>}
      <label className="field">Dienstliche E-Mail-Adresse<input required name="email" type="email" autoComplete="email" maxLength={254} /></label>
      <label className="field">Passwort (mindestens 12 Zeichen)<input required name="password" type="password" minLength={12} autoComplete="new-password" /></label>
      <label className="field">Passwort bestätigen<input required name="confirmPassword" type="password" minLength={12} autoComplete="new-password" /></label>
      <button className="button" disabled={busy || (role !== "schule" && schools.length === 0)}>{busy ? "Konto wird erstellt…" : "Registrieren"}</button>
    </form>
    <p>Schon ein Konto? <Link href="/anmelden">Anmelden</Link></p>
  </main>;
}
