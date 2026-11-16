"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RegistrationRole = "schueler" | "lehrer" | "schule";

export function RegistrationForm({ initialRole }: { initialRole: RegistrationRole }) {
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

    const supabase = createClient();
    const registrationType = role === "schule" ? "school" : role;
    const metadata: Record<string, string | boolean> = {
      registration_type: registrationType,
      contact_name: String(form.get("displayName") ?? "").trim(),
    };
    if (role === "schule") {
      metadata.school_name = String(form.get("schoolName") ?? "").trim();
      metadata.school_type = String(form.get("schoolType") ?? "").trim();
      metadata.street = String(form.get("street") ?? "").trim();
      metadata.postal_code = String(form.get("postalCode") ?? "").trim();
      metadata.city = String(form.get("city") ?? "").trim();
      metadata.state = String(form.get("state") ?? "").trim();
    }

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: String(form.get("email") ?? "").trim(),
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
          data: metadata,
        },
      });
      if (signupError) {
        setError("Registrierung fehlgeschlagen. Prüfe deine Angaben oder versuche es später erneut.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte prüfe die Supabase-Konfiguration.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <main className="formwrap">
      <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
      <h1 style={{ fontSize: "2rem" }}>Registrierung fast fertig</h1>
      <p>Falls die E-Mail-Bestätigung in Supabase eingeschaltet ist, öffne den Link in deinem Postfach und melde dich danach an.</p>
      {role === "schule" && <p>Deine Schule wird automatisch freigeschaltet. Für einen öffentlichen Produktivbetrieb ist diese Einstellung nicht geeignet.</p>}
      <Link href="/anmelden">Zur Anmeldung</Link>
    </main>;
  }

  return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>Konto erstellen</h1>
    <p>Erstelle ein Testkonto. Lehrkräfte- und Schülerkonten sind zunächst keiner Schule zugeordnet.</p>
    {error && <div className="notice" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <label className="field">Ich registriere mich als
        <select value={role} onChange={(event) => setRole(event.target.value as RegistrationRole)}>
          <option value="schueler">Schüler/in</option>
          <option value="lehrer">Lehrkraft</option>
          <option value="schule">Schule (Testmodus: sofort freigeschaltet)</option>
        </select>
      </label>
      <label className="field">{role === "schule" ? "Ansprechperson" : "Vor- und Nachname"}
        <input required name="displayName" autoComplete="name" maxLength={120} />
      </label>
      {role === "schule" && <>
        <label className="field">Schulname<input required name="schoolName" maxLength={160} /></label>
        <label className="field">Schulart<input required name="schoolType" maxLength={100} /></label>
        <label className="field">Straße und Hausnummer<input required name="street" maxLength={200} /></label>
        <label className="field">Postleitzahl<input required name="postalCode" maxLength={20} /></label>
        <label className="field">Stadt<input required name="city" maxLength={120} /></label>
        <label className="field">Bundesland<input required name="state" maxLength={120} /></label>
      </>}
      <label className="field">E-Mail-Adresse<input required name="email" type="email" autoComplete="email" maxLength={254} /></label>
      <label className="field">Passwort (mindestens 12 Zeichen)<input required name="password" type="password" minLength={12} autoComplete="new-password" /></label>
      <button className="button" disabled={busy}>{busy ? "Konto wird erstellt…" : "Registrieren"}</button>
    </form>
    <p>Schon ein Konto? <Link href="/anmelden">Anmelden</Link></p>
  </main>;
}
