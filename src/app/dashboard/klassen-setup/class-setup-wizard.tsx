"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ExistingClass = { id: string; name: string; grade: string | null };
type PlannedClass = { name: string; grade: string };

const suffixOptions = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function ClassSetupWizard({ existingClasses }: { existingClasses: ExistingClass[] }) {
  const [step, setStep] = useState(0);
  const [fromGrade, setFromGrade] = useState(5);
  const [toGrade, setToGrade] = useState(10);
  const [suffixes, setSuffixes] = useState<string[]>(["A", "B", "C", "D"]);
  const [subjectsText, setSubjectsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ createdCount: number; summary: string } | null>(null);

  const planned = useMemo<PlannedClass[]>(() => {
    const subjects: PlannedClass[] = [];
    for (let grade = fromGrade; grade <= toGrade; grade++) {
      for (const suffix of suffixes) subjects.push({ name: String(grade) + suffix, grade: String(grade) });
    }
    return subjects;
  }, [fromGrade, toGrade, suffixes]);

  const existingNames = useMemo(
    () => new Set(existingClasses.map((item) => item.name.toLocaleLowerCase("de-DE"))),
    [existingClasses],
  );
  const alreadyThere = planned.filter((item) => existingNames.has(item.name.toLocaleLowerCase("de-DE")));
  const newClasses = planned.filter((item) => !existingNames.has(item.name.toLocaleLowerCase("de-DE")));
  const tooManyClasses = planned.length > 60;
  const subjects = useMemo(
    () => [...new Set(subjectsText.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 25),
    [subjectsText],
  );

  function toggleSuffix(suffix: string) {
    setSuffixes((current) => current.includes(suffix)
      ? current.filter((item) => item !== suffix)
      : [...current, suffix].sort());
  }

  async function createClasses() {
    if (!planned.length || planned.length > 60 || busy) return;
    setBusy(true);
    setError("");
    try {
      const actions = planned.map((item) => ({
        type: "create_class",
        name: item.name,
        grade: item.grade,
        subjects,
      }));
      const response = await fetch("/api/learning/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Die Klassen konnten nicht angelegt werden.");
      setResult({ createdCount: Number(payload.createdCount ?? 0), summary: String(payload.summary ?? "Die Klassen wurden geprüft.") });
      setStep(3);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Einrichtung ist fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="class-setup-wizard">
      <div className="class-setup-progress" aria-label={"Schritt " + Math.min(step + 1, 3) + " von 3"}>
        <span className={step >= 0 ? "active" : ""}>1 · Jahrgänge</span>
        <span className={step >= 1 ? "active" : ""}>2 · Klassen</span>
        <span className={step >= 2 ? "active" : ""}>3 · Prüfen</span>
      </div>

      {step < 3 ? (
        <>
          <div className="class-setup-ai-message">
            <span className="class-setup-ai-mark">S</span>
            <div>
              <small>SchulWatch KI · Einrichtungsassistent</small>
              <h2>{step === 0 ? "Welche Jahrgänge soll ich für deine Schule vorbereiten?" : step === 1 ? "Wie viele Parallelklassen gibt es pro Jahrgang?" : "So würden deine Klassen aussehen."}</h2>
              <p>{step === 0
                ? "Beispiel: von Klasse 5 bis Klasse 10. Du kannst den Bereich auch später noch ändern."
                : step === 1
                  ? "Wähle die Buchstaben. Bei A, B, C und D entstehen zum Beispiel 5A, 5B, 5C und 5D."
                  : "Ich prüfe vorhandene Klassen und lege nur fehlende an. Nichts wird doppelt erstellt."}</p>
            </div>
          </div>

          {step === 0 && <div className="card class-setup-form">
            <div className="class-setup-selects">
              <label className="field">Von Jahrgang
                <select value={fromGrade} onChange={(event) => setFromGrade(Number(event.target.value))}>
                  {Array.from({ length: 13 }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </label>
              <label className="field">Bis Jahrgang
                <select value={toGrade} onChange={(event) => setToGrade(Number(event.target.value))}>
                  {Array.from({ length: 13 }, (_, index) => index + 1).filter((grade) => grade >= fromGrade).map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                </select>
              </label>
            </div>
            <div className="class-setup-actions">
              <button className="button" type="button" onClick={() => setStep(1)}>Weiter zu den Klassen →</button>
            </div>
          </div>}

          {step === 1 && <div className="card class-setup-form">
            <strong>Welche Buchstaben soll es geben?</strong>
            <div className="class-setup-suffixes">
              {suffixOptions.map((suffix) => <button type="button" key={suffix}
                className={suffixes.includes(suffix) ? "selected" : ""}
                aria-pressed={suffixes.includes(suffix)}
                onClick={() => toggleSuffix(suffix)}>{suffix}</button>)}
            </div>
            <p className="class-setup-hint">Beispiel: A, B, C, D = vier Klassen pro Jahrgang.</p>
            <label className="field">Fächer für alle neuen Klassen (optional)
              <input value={subjectsText} onChange={(event) => setSubjectsText(event.target.value)}
                placeholder="Mathematik, Deutsch, Englisch" maxLength={600} />
            </label>
            {suffixes.length === 0 && <p className="class-setup-error">Wähle mindestens einen Klassenbuchstaben aus.</p>}
            {tooManyClasses && <p className="class-setup-error">Für einen Einrichtungsschritt sind höchstens 60 Klassen möglich. Wähle weniger Jahrgänge oder Buchstaben.</p>}
            <div className="class-setup-actions">
              <button className="button secondary" type="button" onClick={() => setStep(0)}>← Zurück</button>
              <button className="button" type="button" disabled={!suffixes.length || tooManyClasses} onClick={() => setStep(2)}>Vorschau anzeigen →</button>
            </div>
          </div>}

          {step === 2 && <div className="card class-setup-form">
            <div className="class-setup-summary">
              <div><strong>{planned.length}</strong><small>geplante Klassen</small></div>
              <div><strong>{newClasses.length}</strong><small>neu anzulegen</small></div>
              <div><strong>{alreadyThere.length}</strong><small>bereits vorhanden</small></div>
            </div>
            {subjects.length > 0 && <p className="class-setup-hint">Fächer für neue Klassen: {subjects.join(" · ")}</p>}
            <div className="class-setup-class-list">
              {planned.map((item) => <span key={item.name} className={existingNames.has(item.name.toLocaleLowerCase("de-DE")) ? "existing" : ""}>{item.name}</span>)}
            </div>
            {alreadyThere.length > 0 && <p className="class-setup-hint">Vorhandene Klassen werden übersprungen und nicht verändert.</p>}
            {error && <div className="notice" role="alert">{error}</div>}
            <div className="class-setup-actions">
              <button className="button secondary" type="button" disabled={busy} onClick={() => setStep(1)}>← Ändern</button>
              <button className="button" type="button" disabled={busy || !planned.length || newClasses.length === 0}
                onClick={() => void createClasses()}>{busy ? "Klassen werden angelegt …" : "✓ Klassen jetzt erstellen"}</button>
            </div>
          </div>}
        </>
      ) : (
        <div className="card class-setup-success">
          <div className="class-setup-success-mark">✓</div>
          <div className="eyebrow">Einrichtung abgeschlossen</div>
          <h2>{result?.createdCount ?? 0} Klassen neu angelegt</h2>
          <p>{result?.summary}</p>
          <h3>Wie geht es weiter?</h3>
          <p>Als Nächstes kannst du Lehrkräfte den Fächern zuordnen und anschließend die Stundenpläne aufbauen.</p>
          <div className="class-setup-next-links">
            <Link className="button" href="/dashboard/teachers">1. Lehrkräfte & Fächer einrichten →</Link>
            <Link className="button secondary" href="/dashboard/timetable">2. Stundenpläne erstellen</Link>
            <Link className="button secondary" href="/dashboard/schule-setup">3. Schulprofil weiter einrichten</Link>
            <Link href="/dashboard/classes">Alle Klassen ansehen</Link>
          </div>
        </div>
      )}

      {step < 3 && <p className="class-setup-footer">Du behältst die Kontrolle: SchoolWatch zeigt dir die Vorschau und speichert Klassen erst, wenn du auf „Klassen jetzt erstellen“ klickst.</p>}
    </section>
  );
}
