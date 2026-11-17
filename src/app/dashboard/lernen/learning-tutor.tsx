"use client";

import { useState } from "react";

type HomeworkOption = { id: string; subject: string; learning_scope: string | null; description: string; due_at: string };

export function LearningTutor({ homework }: { homework: HomeworkOption[] }) {
  const [homeworkId, setHomeworkId] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<{title:string;url:string}[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setAnswer(""); setSources([]);
    try {
      const response = await fetch("/api/learning/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkId: homeworkId || undefined, message, attempt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die Lern-KI konnte nicht antworten.");
      setAnswer(payload.answer);
      setSources(payload.citations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally { setBusy(false); }
  }

  return <section className="card">
    <div className="eyebrow">SchulWatch Lern-KI</div>
    <h2>Gemeinsam verstehen statt Lösungen abschreiben</h2>
    <p>Die KI orientiert sich an deinen eingetragenen Hausaufgaben und Unterrichtsthemen. Sie gibt Hinweise, prüft deinen Rechenweg und lässt dich den nächsten Schritt selbst machen.</p>
    <form onSubmit={ask}>
      <label className="field">Hausaufgabe auswählen
        <select value={homeworkId} onChange={(event) => setHomeworkId(event.target.value)}>
          <option value="">Freie Lernfrage</option>
          {homework.map((item) => <option key={item.id} value={item.id}>{item.subject}{item.learning_scope ? " · " + item.learning_scope : ""}</option>)}
        </select>
      </label>
      <label className="field">Deine Frage
        <textarea required minLength={2} maxLength={2000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ich verstehe nicht, wie ich diese Aufgabe anfangen soll …" />
      </label>
      <label className="field">Was hast du schon versucht? (dein Rechenweg oder deine Antwort)
        <textarea maxLength={3000} rows={4} value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="Schreibe deinen ersten Schritt hier hinein. Du kannst auch erklären, wo du hängen bleibst." />
      </label>
      <button className="button" disabled={busy}>{busy ? "Die Lern-KI denkt nach …" : "Hinweis bekommen"}</button>
    </form>
    {error && <div className="notice" role="alert">{error}</div>}
    {answer && <article className="notice" role="status"><strong>Dein nächster Lernschritt</strong><p style={{whiteSpace:"pre-wrap"}}>{answer}</p></article>}
    {sources.length > 0 && <div className="ai-sources"><strong>Quellen zur Erklärung</strong>{sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
  </section>;
}
