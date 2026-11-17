"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RegistrationRole = "schueler" | "lehrer" | "schule";
export type SchoolOption = { id: string; name: string; city: string };

const germanStates = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

type Props = { schools: SchoolOption[]; initialRole: RegistrationRole; setupError: boolean };

export function RegistrationForm({ schools: initialSchools, initialRole, setupError: initialSetupError }: Props) {
  const router = useRouter();
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [schools, setSchools] = useState(initialSchools);
  const [setupError, setSetupError] = useState(initialSetupError);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [error, setError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refreshSchools() {
    setLoadingSchools(true);
    setSetupError(false);
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("available_schools");
      if (rpcError) {
        setSetupError(true);
        setSchools([]);
      } else {
        setSchools((data ?? []) as SchoolOption[]);
      }
    } catch {
      setSetupError(true);
      setSchools([]);
    } finally {
      setLoadingSchools(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setConfirmationPending(false);
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 12 || password.length > 72) {
      setError("Das Passwort muss zwischen 12 und 72 Zeichen lang sein.");
      setBusy(false);
      return;
    }
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Die Passwörter stimmen nicht überein.");
      setBusy(false);
      return;
    }

    const email = String(form.get("email") ?? "").trim();
    const schoolId = String(form.get("schoolId") ?? "");
    if (role !== "schule" && !schools.some((school) => school.id === schoolId)) {
      setError("Bitte lade die Schulliste neu und wähle eine verfügbare Schule aus.");
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
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=/dashboard`,
          data: metadata,
        },
      });
      if (signupError) {
        const signupMessage = signupError.message.toLowerCase();
        if (signupMessage.includes("already registered") || signupMessage.includes("already been registered")) {
          setError("Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde dich bitte an oder verwende eine andere E-Mail-Adresse.");
        } else if (signupMessage.includes("longer than 72")) {
          setError("Das Passwort darf höchstens 72 Zeichen lang sein. Bitte kürze es und versuche es erneut.");
        } else {
          setError(`Registrierung fehlgeschlagen: ${signupError.message}`);
        }
      } else if (data.session) {
        // A session means Supabase has accepted direct signup without email confirmation.
        router.replace("/dashboard");
        router.refresh();
      } else if (data.user) {
        // A repeated signup can return a user object without a session.
        // First try a normal password sign-in. This does not bypass email confirmation:
        // Supabase still enforces its own Auth settings and password checks.
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginData.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          const loginMessage = loginError?.message.toLowerCase() ?? "";
          if (loginMessage.includes("email not confirmed")) {
            setConfirmationPending(true);
          } else if (
            data.user.identities?.length === 0 ||
            loginMessage.includes("invalid login credentials")
          ) {
            setError("Für diese E-Mail-Adresse besteht möglicherweise bereits ein Konto oder das Passwort stimmt nicht. Melde dich bitte mit deinem bestehenden Konto an oder nutze die Passwort-zurücksetzen-Funktion.");
          } else {
            setError(loginError
              ? `Anmeldung nach der Registrierung fehlgeschlagen: ${loginError.message}`
              : "Supabase hat kein Anmelde-Token ausgegeben. Bitte versuche die Anmeldung über dein bestehendes Konto.");
          }
        }
      } else {
        setError("Supabase hat kein Konto und keine Sitzung zurückgegeben. Prüfe die Auth-Konfiguration.");
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte prüfe die Supabase-Konfiguration.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>{confirmationPending ? "E-Mail-Bestätigung erforderlich" : "Konto erstellen"}</h1>
    {confirmationPending ? <>
      <div className="notice" role="status">
        Supabase hat für dieses Konto noch keine Anmeldungssitzung erstellt. Prüfe dein Postfach auf eine Bestätigungs-E-Mail. Falls du dieses Konto bereits früher erstellt hast, gehe über „Zur Anmeldung“ und melde dich mit deinem bestehenden Passwort an.
      </div>
      <p>{role === "schule" ? "Die Schulregistrierung wurde angenommen; angemeldet bist du erst, wenn Supabase eine Sitzung ausstellt." : role === "lehrer" ? "Die Lehrkraft-Freigabe durch die Schule ist zusätzlich erforderlich." : "Das Schülerkonto wird nach erfolgreicher Authentifizierung verfügbar sein."}</p>
      <Link className="button secondary" href="/anmelden">Zur Anmeldung</Link>
      <button className="button" type="button" onClick={() => { setConfirmationPending(false); setError(""); }}>Zurück</button>
    </> : <>
      <p>Schulen und Schüler starten direkt. Lehrkräfte können erst nach Freigabe durch die Schule auf deren Bereich zugreifen.</p>
      {setupError && <div className="notice" role="alert">Die Schulliste konnte nicht geladen werden. Prüfe die Supabase-Migrationen bis einschließlich 009 und lade die Liste erneut.</div>}
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
        {role !== "schule" && <div className="field">
          <label htmlFor="schoolId">Schule</label>
          <select id="schoolId" name="schoolId" required defaultValue="">
            <option value="" disabled>Schule auswählen</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name} · {school.city}</option>)}
          </select>
          {schools.length === 0 && <span>Noch keine Schule verfügbar.</span>}
          <button className="button secondary" type="button" onClick={refreshSchools} disabled={loadingSchools}>
            {loadingSchools ? "Schulen werden geladen…" : "Schulliste neu laden"}
          </button>
        </div>}
        {role === "schule" && <>
          <label className="field">Schulname<input required name="schoolName" maxLength={160} /></label>
          <label className="field">Schulart<input required name="schoolType" maxLength={100} /></label>
          <label className="field">Straße und Hausnummer<input required name="street" maxLength={200} /></label>
          <label className="field">Postleitzahl<input required name="postalCode" maxLength={20} /></label>
          <label className="field">Stadt<input required name="city" maxLength={120} /></label>
          <label className="field">Bundesland
            <select required name="state" defaultValue="">
              <option value="" disabled>Bundesland auswählen</option>
              {germanStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
        </>}
        <label className="field">E-Mail-Adresse (Login)<input required name="email" type="email" autoComplete="email" maxLength={254} /></label>
        <label className="field">Passwort (12–72 Zeichen)<input required name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" /></label>
        <label className="field">Passwort bestätigen<input required name="confirmPassword" type="password" minLength={12} maxLength={72} autoComplete="new-password" /></label>
        <button className="button" disabled={busy || (role !== "schule" && schools.length === 0)}>{busy ? "Konto wird erstellt…" : "Registrieren"}</button>
      </form>
      <p>Schon ein Konto? <Link href="/anmelden">Anmelden</Link></p>
    </>}
  </main>;
}
