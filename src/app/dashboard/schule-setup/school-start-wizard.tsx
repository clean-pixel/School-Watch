"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const suffixOptions = ["A", "B", "C", "D", "E", "F"];

export function SchoolStartWizard({ schoolName }: { schoolName: string }) {
  const [startGrade, setStartGrade] = useState("5");
  const [endGrade, setEndGrade] = useState("10");
  const [parallelClasses, setParallelClasses] = useState("3");
  const [suffixes, setSuffixes] = useState(["A", "B", "C"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const proposed = useMemo(() => {
    const start = Number(startGrade);
    const end = Number(endGrade);
    const letters = suffixes.slice(0, Number(parallelClasses));
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start || end - start > 12 || !letters.length) return [];
    const list: Array<{ type: "create_class"; name: string; grade: string; subjects: string[] }> = [];
    for (let grade = start; grade <= end; grade++) {
      for (const suffix of letters) {
        list.push({ type: "create_class", name: String(grade) + suffix, grade: String(grade), subjects: [] });
      }
    }
    return list;
  }, [startGrade, endGrade, parallelClasses, suffixes]);

  function toggleSuffix(letter: string) {
    setSuffixes((current) => current.includes(letter)
      ? current.filter((item) => item !== letter)
      : [...current, letter].sort());
  }

  async function createClasses() {
    setError("");
    if (!proposed.length || proposed.length > 20) {
      setError("Bitte wähle einen Bereich mit höchstens 20 Klassen. Du kannst danach weitere Klassen anlegen.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/learning/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: proposed }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Die Klassen konnten nicht angelegt werden.");
      const created = Number(result.createdCount ?? 0);
      setSavedCount(created);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Klassen konnten nicht angelegt werden.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="school-start-wizard card">
    <style jsx global>{`
      .school-start-wizard{margin:24px 0;overflow:hidden}
      .school-start-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
      .school-start-head h2{margin:6px 0 8px}
      .school-start-step{display:inline-flex;border:1px solid var(--border);border-radius:999px;padding:6px 10px;color:var(--purple);font-size:.78rem;white-space:nowrap}
      .school-start-question{margin:22px 0 8px;font-size:1.08rem;font-weight:750}
      .school-start-hint{color:var(--muted);font-size:.9rem}
      .school-start-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:16px 0}
      .school-start-letters{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}
      .school-start-letters button{min-width:44px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;background:transparent;color:var(--white);cursor:pointer}
      .school-start-letters button[aria-pressed=true]{border-color:var(--purple);background:var(--purple-soft);color:var(--purple)}
      .school-start-preview{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0}
      .school-start-preview span{padding:7px 10px;border:1px solid var(--border);border-radius:9px;font-size:.86rem}
      .school-start-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .school-start-tutorial{margin-top:18px;padding:18px;border:1px solid var(--border);border-radius:14px;background:rgba(167,139,250,.06)}
      .school-start-tutorial li{margin:10px 0}
      @media(max-width:620px){.school-start-fields{grid-template-columns:1fr}.school-start-head{flex-direction:column}}
    `}</style>
    <div className="school-start-head">
      <div>
        <div className="eyebrow">SchulWatch KI · Einrichtungsassistent</div>
        <h2>Wir richten {schoolName} gemeinsam ein.</h2>
        <p className="school-start-hint">Ich stelle dir ein paar einfache Fragen und bereite deine Klassen vor. Gespeichert wird erst, wenn du den Vorschlag bestätigst.</p>
      </div>
      <span className="school-start-step">{done ? "Einrichtung gestartet" : "Schritt 1 von 3"}</span>
    </div>

    {!done ? <>
      <div className="school-start-question">KI: Mit welchen Jahrgangsstufen arbeitet deine Schule?</div>
      <div className="school-start-fields">
        <label className="field">Erster Jahrgang
          <select value={startGrade} onChange={(event) => setStartGrade(event.target.value)}>
            {Array.from({ length: 13 }, (_, index) => String(index + 1)).map((grade) => <option key={grade} value={grade}>{grade}. Klasse</option>)}
          </select>
        </label>
        <label className="field">Letzter Jahrgang
          <select value={endGrade} onChange={(event) => setEndGrade(event.target.value)}>
            {Array.from({ length: 13 }, (_, index) => String(index + 1)).filter((grade) => Number(grade) >= Number(startGrade)).map((grade) => <option key={grade} value={grade}>{grade}. Klasse</option>)}
          </select>
        </label>
        <label className="field">Parallelklassen pro Jahrgang
          <select value={parallelClasses} onChange={(event) => { setParallelClasses(event.target.value); setSuffixes(suffixOptions.slice(0, Number(event.target.value))); }}>
            {[1,2,3,4,5,6].map((count) => <option key={count} value={count}>{count} {count === 1 ? "Klasse" : "Klassen"}</option>)}
          </select>
        </label>
      </div>
      <div className="school-start-question">KI: Welche Buchstaben sollen die Klassen bekommen?</div>
      <p className="school-start-hint">Zum Beispiel A, B, C und D. Du kannst die Auswahl anpassen.</p>
      <div className="school-start-letters">
        {suffixOptions.map((letter) => <button type="button" key={letter} aria-pressed={suffixes.includes(letter)} onClick={() => toggleSuffix(letter)}>{letter}</button>)}
      </div>
      <div className="school-start-question">Deine Vorschau</div>
      <p className="school-start-hint">{proposed.length} Klassen werden vorbereitet.</p>
      <div className="school-start-preview">
        {proposed.slice(0, 24).map((item) => <span key={item.name}>{item.name}</span>)}
        {proposed.length > 24 && <span>+ weitere</span>}
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      <div className="school-start-actions">
        <button type="button" className="button" onClick={createClasses} disabled={busy || !proposed.length || proposed.length > 20}>
          {busy ? "Klassen werden vorbereitet …" : "✓ Klassen erstellen"}
        </button>
        <span className="school-start-hint">Maximal 20 auf einmal · du kannst später weitere ergänzen</span>
      </div>
    </> : <div className="school-start-tutorial">
      <div className="eyebrow">KI-Tutorial · Nächste Schritte</div>
      <h3>Super! Deine Klassen sind vorbereitet.</h3>
      <p>{savedCount} neue Klassen wurden angelegt. Jetzt gehen wir gemeinsam die restliche Einrichtung durch.</p>
      <ol>
        <li><strong>Fächer eintragen:</strong> Hinterlege Mathematik, Deutsch, Englisch und weitere Fächer für deine Klassen.</li>
        <li><strong>Lehrkräfte zuordnen:</strong> Trage Lehrkräfte ein und ordne sie den passenden Fächern zu.</li>
        <li><strong>Stundenplan erstellen:</strong> Die KI kann dir beim Aufbau der Stundenpläne helfen.</li>
        <li><strong>Schüler zuordnen:</strong> Weise freigegebene Schülerkonten den richtigen Klassen zu.</li>
      </ol>
      <div className="school-start-actions">
        <Link className="button" href="/dashboard/classes">Weiter: Klassen prüfen</Link>
        <Link className="button secondary" href="/dashboard/lernen">Mit der KI weitermachen</Link>
      </div>
    </div>}
  </section>;
}
