"use client";

import { useState } from "react";

type Task = { id: string; subject: string; description: string; learning_scope: string; due_at: string };

export function StudentTutor({ tasks }: { tasks: Task[] }) {
  const [homeworkId, setHomeworkId] = useState(tasks[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [attempt, setAttempt] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<{title:string;url:string}[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    setError("");
    setAnswer("");
    setCitations([]);
    setBusy(true);
    try {
      const response = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkId, question, attempt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Der Lerncoach ist gerade nicht erreichbar.");
      setAnswer(payload.answer || "");
      setCitations(payload.citations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  if (tasks.length === 0) return <article className="card"><h2>Dein Lerncoach</h2><p>Du hast noch keine Hausaufgabe, die der Lerncoach verwenden kann. Sobald deine Lehrkraft eine Aufgabe mit Lernziel und Thema einträgt, erscheint sie hier.</p></article>;

  return (
    <div className="grid ai-layout">
      <section className="card">
        <div className="eyebrow">Schritt für Schritt lernen</div>
        <h2>Wobei brauchst du Hilfe?</h2>
        <label className="field">Hausaufgabe auswählen
          <select value={homeworkId} onChange={(event) => setHomeworkId(event.target.value)}>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.subject} · {task.description.slice(0, 70)}</option>)}
          </select>
        </label>
        <label className="field">Deine Frage
          <textarea rows={3} maxLength={1200} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Erkläre mir bitte, was ich bei Aufgabe 2 beachten muss …" />
        </label>
        <label className="field">Was hast du selbst schon versucht?
          <textarea rows={5} maxLength={2000} value={attempt} onChange={(event) => setAttempt(event.target.value)} placeholder="Schreibe deinen Rechenweg, deine Überlegung oder den ersten Versuch auf …" />
        </label>
        <p className="small-note">Der Lerncoach gibt dir Hinweise und erklärt den Stoff. Er schreibt nicht einfach die fertige Hausaufgabe für dich.</p>
        {error && <div className="notice" role="alert">{error}</div>}
        <button type="button" className="button" disabled={busy || !homeworkId || question.trim().length < 4 || attempt.trim().length < 8} onClick={ask}>
          {busy ? "Lerncoach denkt nach …" : "Hinweis bekommen"}
        </button>
      </section>
      <section className="card ai-answer">
        <div className="eyebrow">Dein Lerncoach</div>
        <h2>Dein nächster Lernschritt</h2>
        {answer ? <div className="ai-response" aria-live="polite">{answer}</div> : <p>Hier erscheint die Erklärung mit einem kleinen Hinweis und einer Frage, mit der du selbst weiterarbeiten kannst.</p>}
        {citations.length > 0 && <div className="ai-sources"><strong>Quellen aus der Recherche</strong>{citations.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer">{item.title}</a>)}</div>}
      </section>
    </div>
  );
}
