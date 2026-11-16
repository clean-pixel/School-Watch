"use client";
import { useState } from "react";
type Request = { id: string; status: string; created_at: string };
export function ToiletRequestPanel() {
  const [request, setRequest] = useState<Request | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function send() { setBusy(true); setMessage(""); try { const response = await fetch("/api/toilet-requests", { method: "POST" }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Anfrage fehlgeschlagen."); setRequest(body.request); setMessage("Deine Anfrage wurde gesendet."); } catch (e) { setMessage(e instanceof Error ? e.message : "Verbindung fehlgeschlagen."); } finally { setBusy(false); } }
  async function refresh() { try { const response = await fetch("/api/toilet-requests", { cache: "no-store" }); const body = await response.json(); if (response.ok) setRequest(body.requests?.find((r: Request) => r.status === "pending") ?? body.requests?.[0] ?? null); } catch { setMessage("Status konnte nicht aktualisiert werden."); } }
  const status = request?.status === "pending" ? "Wartet auf Antwort" : request?.status === "approved" ? "Deine Toilettenanfrage wurde genehmigt." : request?.status === "denied" ? "Deine Toilettenanfrage wurde abgelehnt." : null;
  return <div><button className="button" onClick={send} disabled={busy || request?.status === "pending"}>{busy ? "Wird gesendet…" : request?.status === "pending" ? "Anfrage offen" : "Darf ich auf Toilette?"}</button>{status && <p role="status">{status}</p>}<button className="button secondary" style={{ marginLeft: 8 }} onClick={refresh}>Status aktualisieren</button>{message && <p role="alert">{message}</p>}</div>;
}
export function ToiletDecision({ id }: { id: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function decide(decision: "approved" | "denied") { setBusy(true); setMessage(""); try { const response = await fetch("/api/toilet-requests/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: id, decision }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Aktion fehlgeschlagen."); setMessage(decision === "approved" ? "Anfrage genehmigt." : "Anfrage abgelehnt."); } catch (e) { setMessage(e instanceof Error ? e.message : "Verbindung fehlgeschlagen."); } finally { setBusy(false); } }
  return <div><button className="button" disabled={busy} onClick={() => decide("approved")}>Genehmigen</button> <button className="button secondary" disabled={busy} onClick={() => decide("denied")}>Ablehnen</button>{message && <p role="status">{message}</p>}</div>;
}
