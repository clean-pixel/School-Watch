"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: String(data.get("email") ?? "").trim(), password: String(data.get("password") ?? "") });
      if (loginError) {
        setError("Anmeldung nicht möglich. Prüfe E-Mail, Passwort und eine gegebenenfalls nötige E-Mail-Bestätigung.");
        setBusy(false);
        return;
      }
      location.assign("/dashboard");
    } catch {
      setError("Supabase ist nicht erreichbar oder noch nicht konfiguriert.");
      setBusy(false);
    }
  }

  return <main className="formwrap">
    <Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link>
    <h1 style={{ fontSize: "2rem" }}>Anmelden</h1>
    <p>Melde dich mit deinem SchulWatch-Konto an. Du bleibst auf diesem Gerät bis zu 30 Tage angemeldet, solange du dich nicht abmeldest.</p>
    {error && <div className="notice" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <label className="field">E-Mail-Adresse<input required name="email" type="email" autoComplete="email" /></label>
      <label className="field">Passwort<input required name="password" type="password" autoComplete="current-password" /></label>
      <button className="button" disabled={busy}>{busy ? "Anmeldung läuft…" : "Anmelden"}</button>
    </form>
    <p>Noch kein Konto? <Link href="/registrieren?rolle=schule">Schule</Link> · <Link href="/registrieren?rolle=lehrer">Lehrkraft</Link> · <Link href="/registrieren?rolle=schueler">Schüler/in</Link></p>
    <p><Link href="/passwort-vergessen">Passwort vergessen?</Link></p>
  </main>;
}
