"use client";

import { useState } from "react";
import { saveLessonWorksheet } from "@/app/dashboard/actions";

type ClassOption = { id: string; name: string; grade: string | null };
type SubjectOption = { class_id: string; subject: string };

export function WorksheetGenerator({ classes, subjects }: { classes: ClassOption[]; subjects: SubjectOption[] }) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [learningScope, setLearningScope] = useState("");
  const [difficulty, setDifficulty] = useState<"leicht"|"mittel"|"anspruchsvoll">("mittel");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const availableSubjects = subjects.filter((item) => item.class_id === classId).map((item) => item.subject);
  const effectiveSubject = availableSubjects.includes(subject) ? subject : availableSubjects[0] ?? "";

  async function generate() {
    setError("");
    setContent("");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/worksheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, subject: effectiveSubject, topic, learningScope, difficulty }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Arbeitsblatt konnte nicht erstellt werden.");
      setContent(payload.worksheet || "");
      setTitle(topic);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  if (classes.length === 0) return <article className="card"><p>Es sind noch keine Klassen sichtbar. Lege zuerst Klassen und Fächer an oder prüfe, ob du den Klassen zugeordnet bist.</p></article>;

  return (
    <div className="grid ai-layout">
      <section className="card">
        <div className="eyebrow">Unterrichtsvorbereitung</div>
        <h2>Neues Arbeitsblatt</h2>
        <label className="field">Klasse
          <select value={classId} onChange={(event) => { setClassId(event.target.value); setSubject(""); }}>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.grade ? ` · ${item.grade}` : ""}</option>)}
          </select>
        </label>
        <label className="field">Fach
          <select value={effectiveSubject} onChange={(event) => setSubject(event.target.value)}>
            {availableSubjects.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">Thema
          <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="z. B. Bruchrechnen: Addieren und Subtrahieren" />
        </label>
        <label className="field">Lernziele / Unterrichtsstoff
          <textarea rows={3} maxLength={1000} value={learningScope} onChange={(event) => setLearningScope(event.target.value)} placeholder="Was sollen die Schüler nach dem Arbeitsblatt können?" />
        </label>
        <label className="field">Niveau
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
            <option value="leicht">Leicht</option>
            <option value="mittel">Mittel</option>
            <option value="anspruchsvoll">Anspruchsvoll</option>
          </select>
        </label>
        {availableSubjects.length === 0 && <div className="notice">Für diese Klasse sind noch keine Fächer hinterlegt. Bitte ergänze zuerst die Fächer im Schulprofil.</div>}
        {error && <div className="notice" role="alert">{error}</div>}
        <button className="button" type="button" disabled={busy || !effectiveSubject || topic.trim().length < 3} onClick={generate}>
          {busy ? "Arbeitsblatt wird erstellt …" : "Arbeitsblatt mit KI erstellen"}
        </button>
      </section>
      <section className="card">
        <div className="eyebrow">Vorschau</div>
        <h2>Arbeitsblatt prüfen</h2>
        {content ? <>
          <div className="ai-response">{content}</div>
          <form action={saveLessonWorksheet} className="worksheet-save-form">
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="subject" value={effectiveSubject} />
            <input type="hidden" name="topic" value={topic} />
            <input type="hidden" name="content" value={content} />
            <label className="field">Titel
              <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
            </label>
            <label className="check-field"><input type="checkbox" name="publish" value="true" /> Für die ausgewählte Klasse freigeben</label>
            <button className="button">Arbeitsblatt speichern</button>
          </form>
        </> : <p>Nach der Erstellung kannst du das Arbeitsblatt hier prüfen und speichern. Die KI fügt keine Musterlösungen ein.</p>}
      </section>
    </div>
  );
}
