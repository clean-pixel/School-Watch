"use client";

import { useEffect, useState } from "react";

export function FocusTimer({ saveAction }: { saveAction: (formData: FormData) => void | Promise<void> }) {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(timer); setRunning(false); setFinished(true); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  function updateFocus(value: number) { setFocusMinutes(value); setSeconds(value * 60); setFinished(false); }
  return <section className="card focus-card">
    <div className="eyebrow">Ablenkungsfrei lernen</div>
    <div className="focus-clock" aria-live="polite">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</div>
    <div className="grid focus-controls">
      <label className="field">Lernzeit (Minuten)<input type="number" min={5} max={180} value={focusMinutes} disabled={running} onChange={(event) => updateFocus(Number(event.target.value))} /></label>
      <label className="field">Pause (Minuten)<input type="number" min={1} max={60} value={breakMinutes} disabled={running} onChange={(event) => setBreakMinutes(Number(event.target.value))} /></label>
    </div>
    <div className="actions">
      <button className="button" type="button" onClick={() => { setRunning((value) => !value); setFinished(false); }}>{running ? "Pausieren" : seconds === focusMinutes * 60 ? "Starten" : "Fortsetzen"}</button>
      <button className="button secondary" type="button" onClick={() => { setRunning(false); setSeconds(focusMinutes * 60); setFinished(false); }}>Zurücksetzen</button>
      {finished && <form action={saveAction}><input type="hidden" name="focusMinutes" value={focusMinutes} /><input type="hidden" name="breakMinutes" value={breakMinutes} /><button className="button">Lerneinheit speichern</button></form>}
    </div>
    <p>Keine Rangliste, kein Leistungsdruck. Wenn der Timer endet, gönn dir eine Pause.</p>
  </section>;
}
