"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RegistrationRole = "schueler" | "lehrer" | "schule";
export type SchoolOption = { id: string; name: string; city: string };

type Props = { schools: SchoolOption[]; initialRole: RegistrationRole; setupError: boolean };

export function RegistrationForm({ schools, initialRole, setupError }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 12 || password.length > 128) {
      setError("Das Passwort muss zwischen 12 und 128 Zeichen lang sein.");
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
    } else metadata.school_id = schoolId;

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
        setError("Registrierung fehlgeschlagen. Prüfe deine Angaben und ob die Supabase-Migrationen eingerichtet sind.");
      } else if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte prüfe die Supabase-Konfiguration.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>{role === "schule" ? "Schulkonto erstellt" : "Registrierung eingegangen"}</h1>
    {role === "schule"
      ? <p>Dein Konto ist als Schulleitung eingerichtet. Bestätige, falls verlangt, deine E-Mail-Adresse. Danach kannst du dich anmelden und direkt den Schulbereich öffnen.</p>
      : role === "lehrer"
        ? <p>Deine ausgewählte Schule muss den Lehrkraft-Zugang erst freigeben. Eine zusätzliche E-Mail-Bestätigung hängt von deinen Supabase-Einstellungen ab.</p>
        : <p>Dein Schülerkonto wurde der ausgewählten Schule zugeordnet. Bestätige, falls verlangt, deine E-Mail-Adresse.</p>}
    <Link className="button" href="/anmelden">Zur Anmeldung</Link>
  </main>;

  return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>Konto erstellen</h1>
    <p>Schulen und Schüler starten direkt. Lehrkräfte können erst nach Freigabe durch die Schule auf deren Bereich zugreifen.</p>
    {setupError && <div className="notice" role="alert">Die Schulliste konnte nicht geladen werden. Prüfe, ob die Supabase-Migrationen bis einschließlich 005 ausgeführt wurden.</div>}
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
        {schools.length === 0 && <span>Noch keine Schule verfügbar. Registriere zuerst eine Schule.</span>}
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
      <label className="field">Passwort (12–128 Zeichen)<input required name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <label className="field">Passwort bestätigen<input required name="confirmPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" /></label>
      <button className="button" disabled={busy || (role !== "schule" && schools.length === 0)}>{busy ? "Konto wird erstellt…" : "Registrieren"}</button>
    </form>
    <p>Schon ein Konto? <Link href="/anmelden">Anmelden</Link></p>
  </main>;
}
