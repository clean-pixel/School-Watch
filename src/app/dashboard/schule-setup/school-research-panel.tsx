"use client";

import { useState } from "react";
import { applySchoolResearch, updateSchoolHours } from "@/app/dashboard/actions";

type Research = {
  found: boolean;
  officialName?: string;
  schoolType?: string;
  address?: string;
  website?: string;
  confidence?: "hoch"|"mittel"|"niedrig";
  summary?: string;
  sources: string[];
  classes: { name: string; grade?: string; subjects: string[] }[];
};

export function SchoolResearchPanel({
  school,
  dayStart,
  dayEnd,
  classesCount,
}: {
  school: { name: string; state: string; city: string };
  dayStart: string;
  dayEnd: string;
  classesCount: number;
}) {
  const [research, setResearch] = useState<Research | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function researchSchool() {
    setBusy(true);
    setError("");
    setResearch(null);
    try {
      const response = await fetch("/api/schools/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: school.name, state: school.state, city: school.city }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die Schulrecherche ist fehlgeschlagen.");
      setResearch(payload.research as Research);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid ai-layout">
      <section className="card">
        <div className="eyebrow">Schulprofil</div>
        <h2>{school.name}</h2>
        <p>{school.city} · {school.state}</p>
        <form action={updateSchoolHours}>
          <h3>Zeiten des Schultages</h3>
          <label className="field">Erster möglicher Unterrichtsbeginn
            <input type="time" name="dayStart" required defaultValue={dayStart.slice(0,5)} />
          </label>
          <label className="field">Spätestes Unterrichtsende
            <input type="time" name="dayEnd" required defaultValue={dayEnd.slice(0,5)} />
          </label>
          <button className="button secondary">Schulzeiten speichern</button>
        </form>
        <div className="divider-line"/>
        <h3>Schule im Internet prüfen</h3>
        <p>Die KI sucht offizielle Informationen zur Schule und kann Klassen- und Fächervorschläge vorbereiten. Übernommen wird nichts, bevor du die Vorschläge geprüft und bestätigt hast.</p>
        <button className="button" type="button" disabled={busy} onClick={researchSchool}>
          {busy ? "Offizielle Quellen werden geprüft …" : "Schule mit KI recherchieren"}
        </button>
        {error && <div className="notice" role="alert">{error}</div>}
        <p className="small-note">Aktuell sind {classesCount} Klassen in SchulWatch angelegt.</p>
      </section>
      <section className="card">
        <div className="eyebrow">Prüfungsergebnis</div>
        <h2>Klassen und Fächer</h2>
        {!research && <p>Nach der Recherche erscheinen hier der gefundene Schulname, die Quellen und alle verifizierbaren Vorschläge.</p>}
        {research && <>
          <div className={`notice ${research.found ? "" : "notice-warning"}`}>
            <strong>{research.found ? research.officialName || "Schule gefunden" : "Schule nicht eindeutig verifiziert"}</strong>
            <p>{research.summary || "Keine zusätzliche Zusammenfassung."}</p>
            {research.schoolType && <p>Schulart: {research.schoolType}</p>}
            {research.address && <p>Anschrift: {research.address}</p>}
            {research.confidence && <p>Vertrauensniveau: {research.confidence}</p>}
          </div>
          <div className="ai-sources"><strong>Quellen</strong>{research.sources.map((source) => <a key={source} href={source} target="_blank" rel="noreferrer">{source}</a>)}</div>
          {research.classes.length > 0 ? <>
            <h3>Vorgeschlagene Klassen</h3>
            <div className="research-class-list">
              {research.classes.map((item) => <article className="research-class" key={item.name}><strong>{item.name}</strong>{item.grade && <span>Jahrgang {item.grade}</span>}<p>{item.subjects.join(" · ") || "Keine Fächer aus offizieller Quelle erkannt."}</p></article>)}
            </div>
            {research.found && research.sources.length > 0 && <form action={applySchoolResearch}>
              <input type="hidden" name="research" value={JSON.stringify(research)} />
              <div className="notice">Bitte prüfe jede Klasse und jedes Fach. Erst nach deiner Bestätigung werden neue Einträge in SchulWatch angelegt. Vorhandene Klassen bleiben erhalten.</div>
              <button className="button">Geprüfte Vorschläge übernehmen</button>
            </form>}
          </> : <div className="notice">Es wurden keine konkreten Klassen mit offiziellen Belegen gefunden. Du kannst Klassen und Fächer manuell ergänzen.</div>}
        </>}
      </section>
    </div>
  );
}
