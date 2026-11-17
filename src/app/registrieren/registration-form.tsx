"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RegistrationRole = "schueler" | "lehrer" | "schule";
export type SchoolOption = { id: string; name: string; city: string };

const germanStates = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
];

const REGISTRATION_DRAFT_KEY = "schulwatch-registration-draft-v1";
const draftFields = [
  "displayName", "schoolId", "schoolName", "schoolType", "street",
  "postalCode", "city", "state", "email",
] as const;
type DraftField = (typeof draftFields)[number];
type RegistrationDraft = {
  role?: RegistrationRole;
} & Partial<Record<DraftField, string>>;

type Props = { schools: SchoolOption[]; initialRole: RegistrationRole; setupError: string };

export function RegistrationForm({ schools: initialSchools, initialRole, setupError: initialSetupError }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const draftToRestore = useRef<RegistrationDraft | null>(null);
  const [role, setRole] = useState<RegistrationRole>(initialRole);
  const [schools, setSchools] = useState(initialSchools);
  const [setupError, setSetupError] = useState(initialSetupError);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [error, setError] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keep a registration draft on this device so navigation/reloads do not erase it.
  // Passwords are intentionally never stored in browser storage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as RegistrationDraft;
      draftToRestore.current = draft;
      if (draft.role === "schueler" || draft.role === "lehrer" || draft.role === "schule") {
        setRole(draft.role);
      }
    } catch {
      try { window.localStorage.removeItem(REGISTRATION_DRAFT_KEY); } catch { /* Browser storage may be disabled. */ }
    }
  }, []);

  useEffect(() => {
    const draft = draftToRestore.current;
    const form = formRef.current;
    if (!draft || draft.role !== role || !form) return;

    for (const name of draftFields) {
      const value = draft[name];
      const field = form.elements.namedItem(name);
      if (typeof value === "string" && (field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
        field.value = value;
      }
    }
    draftToRestore.current = null;
  }, [role]);

  function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    try {
      const formData = new FormData(event.currentTarget);
      const storedRole = formData.get("role");
      const draft: RegistrationDraft = {
        role: storedRole === "schule" || storedRole === "lehrer" ? storedRole : "schueler",
      };
      for (const name of draftFields) {
        const value = formData.get(name);
        draft[name] = typeof value === "string" ? value : "";
      }
      window.localStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Registration must remain usable even when browser storage is unavailable.
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
    } catch {
      // Ignore unavailable browser storage.
    }
  }

  async function refreshSchools() {
    setLoadingSchools(true);
    setSetupError("");
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("available_schools");
      if (rpcError) {
        setSetupError(`Schulabfrage fehlgeschlagen: ${rpcError.message}`);
        setSchools([]);
      } else {
        setSchools((data ?? []) as SchoolOption[]);
      }
    } catch (cause) {
      setSetupError(cause instanceof Error ? cause.message : "Unbekannter Verbindungsfehler.");
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
        clearDraft();
        router.replace("/dashboard");
        router.refresh();
      } else if (data.user) {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (loginData.session) {
          clearDraft();
          router.replace("/dashboard");
          router.refresh();
        } else {
          const loginMessage = loginError?.message.toLowerCase() ?? "";
          if (loginMessage.includes("email not confirmed")) {
            clearDraft();
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
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Unbekannter Verbindungsfehler.";
      setError(`Verbindung zu Supabase fehlgeschlagen: ${detail} Prüfe die Supabase-Variablen in Vercel und starte die Website nach Änderungen neu.`);
    } finally {
      setBusy(false);
    }
  }

  return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>{confirmationPending ? "E-Mail-Bestätigung erforderlich" : "Konto erstellen"}</h1>
    <p className="muted">Deine Formulareingaben werden auf diesem Gerät zwischengespeichert. Passwörter werden niemals gespeichert.</p>
    {confirmationPending ? <>
      <div className="notice" role="status">
        Supabase hat für dieses Konto noch keine Anmeldungssitzung erstellt. Prüfe dein Postfach auf eine Bestätigungs-E-Mail. Falls du dieses Konto bereits früher erstellt hast, gehe über „Zur Anmeldung“ und melde dich mit deinem bestehenden Passwort an.
      </div>
      <p>{role === "schule" ? "Die Schulregistrierung wurde angenommen; angemeldet bist du erst, wenn Supabase eine Sitzung ausstellt." : role === "lehrer" ? "Die Lehrkraft-Freigabe durch die Schule ist zusätzlich erforderlich." : "Das Schülerkonto wird nach erfolgreicher Authentifizierung verfügbar sein."}</p>
      <Link className="button secondary" href="/anmelden">Zur Anmeldung</Link>
      <button className="button" type="button" onClick={() => { setConfirmationPending(false); setError(""); }}>Zurück</button>
    </> : <>
      {setupError && <div className="notice" role="alert">Die Schulliste konnte nicht geladen werden. {setupError} Prüfe in Vercel unter Settings → Environment Variables, ob NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY oder NEXT_PUBLIC_SUPABASE_ANON_KEY gesetzt sind.</div>}
      {error && <div className="notice" role="alert">{error}</div>}
      <form ref={formRef} onSubmit={submit} onChange={saveDraft}>
        <label className="field">Ich registriere mich als
          <select name="role" value={role} onChange={(event) => setRole(event.target.value as RegistrationRole)}>
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
