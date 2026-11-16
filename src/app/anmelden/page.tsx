"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage(){const [error,setError]=useState("");const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError("");setBusy(true);const data=new FormData(e.currentTarget);const supabase=createClient();const {error}=await supabase.auth.signInWithPassword({email:String(data.get("email")),password:String(data.get("password"))});setBusy(false);if(error){setError("Anmeldung nicht möglich. Prüfe deine Zugangsdaten und ob deine E-Mail bestätigt wurde.");return;}location.assign("/dashboard");}
 return <main className="formwrap"><Link className="brand" href="/"><span className="brand-mark">S</span> SchulWatch One</Link><h1 style={{fontSize:"2rem"}}>Anmelden</h1><p>Mit deinem SchulWatch-One-Konto anmelden.</p>{error&&<div className="notice" role="alert">{error}</div>}<form onSubmit={submit}><label className="field">E-Mail-Adresse<input required name="email" type="email" autoComplete="email"/></label><label className="field">Passwort<input required name="password" type="password" autoComplete="current-password"/></label><button className="button" disabled={busy}>{busy?"Anmeldung läuft…":"Anmelden"}</button></form><p><Link href="/passwort-vergessen">Passwort vergessen?</Link> · <Link href="/">Zur Startseite</Link></p></main>
}
