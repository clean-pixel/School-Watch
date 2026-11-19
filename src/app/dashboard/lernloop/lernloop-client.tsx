"use client";

import { useMemo, useState, type FormEvent } from "react";

export type LernLoopCard = {
  id: string;
  subject: string;
  question: string;
  answer: string;
  due_at: string;
  interval_days: number;
  repetitions: number;
};

type DraftCard = { question: string; answer: string };
type Grade = "again" | "hard" | "good" | "easy";

async function postAction(body: Record<string, unknown>) {
  const response = await fetch("/api/learning/flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Die Aktion konnte nicht gespeichert werden.");
  return payload;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function LernLoop({ initialCards }: { initialCards: LernLoopCard[] }) {
  const [cards, setCards] = useState(initialCards);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [subject, setSubject] = useState("Allgemein");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<DraftCard[]>([]);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualAnswer, setManualAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dueCards = useMemo(
    () => cards.filter((card) => new Date(card.due_at).getTime() <= Date.now())
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()),
    [cards],
  );
  const nextCard = useMemo(
    () => [...cards].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0],
    [cards],
  );
  const subjects = useMemo(() => new Set(cards.map((card) => card.subject)).size, [cards]);
  const current = dueCards[0];

  async function generateCards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setDrafts([]);
    setBusy(true);
    try {
      const result = await postAction({ action: "generate", subject, notes });
      setDrafts(result.cards as DraftCard[]);
      setMessage("Deine Vorschau ist fertig. Prüfe die Karten und speichere sie anschließend.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die KI konnte keine Karten erstellen.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGenerated() {
    setError("");
    setBusy(true);
    try {
      const result = await postAction({ action: "save_generated", subject, cards: drafts });
      setCards((old) => [...(result.cards as LernLoopCard[]), ...old]);
      setDrafts([]);
      setNotes("");
      setMessage("Die Lernkarten wurden gespeichert.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Karten konnten nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function createManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await postAction({ action: "create", subject, question: manualQuestion, answer: manualAnswer });
      setCards((old) => [result.card as LernLoopCard, ...old]);
      setManualQuestion("");
      setManualAnswer("");
      setMessage("Deine Lernkarte wurde gespeichert.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Lernkarte konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function review(grade: Grade) {
    if (!current) return;
    setError("");
    setBusy(true);
    try {
      const result = await postAction({ action: "review", id: current.id, grade });
      setCards((old) => old.map((card) => card.id === current.id ? result.card as LernLoopCard : card));
      setShowAnswer(false);
      setReviewed((count) => count + 1);
      setMessage(
        grade === "again" ? "Alles gut – diese Karte kommt in zehn Minuten wieder."
          : grade === "hard" ? "Gespeichert. Diese Karte kommt bald wieder."
          : grade === "good" ? "Gut gemacht. Die nächste Wiederholung ist eingeplant."
          : "Sicher gewusst. Die nächste Wiederholung liegt weiter in der Zukunft.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dein Lernfortschritt konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lernloop-shell">
      <div className="lernloop-stats">
        <article className="card"><span className="lernloop-stat-label">Jetzt fällig</span><strong>{dueCards.length}</strong><span className="lernloop-stat-foot">Karten zum Wiederholen</span></article>
        <article className="card"><span className="lernloop-stat-label">Deine Sammlung</span><strong>{cards.length}</strong><span className="lernloop-stat-foot">{subjects} {subjects === 1 ? "Fach" : "Fächer"}</span></article>
        <article className="card"><span className="lernloop-stat-label">Diese Sitzung</span><strong>{reviewed}</strong><span className="lernloop-stat-foot">bearbeitete Karten</span></article>
      </div>

      {message && <div className="notice" role="status">{message}</div>}
      {error && <div className="notice" role="alert">{error}</div>}

      <div className="lernloop-columns">
        <section className="card lernloop-study">
          <div className="lernloop-panel-heading">
            <div><div className="eyebrow">Wiederholen</div><h2>Deine nächste Karte</h2></div>
            <span className="lernloop-count">{dueCards.length} fällig</span>
          </div>
          {current ? (
            <>
              <div className="lernloop-subject">{current.subject}</div>
              <div className="lernloop-question">{current.question}</div>
              {showAnswer ? (
                <div className="lernloop-answer"><span>Antwort</span><p>{current.answer}</p></div>
              ) : (
                <button className="button secondary lernloop-reveal" type="button" onClick={() => setShowAnswer(true)}>Antwort anzeigen</button>
              )}
              {showAnswer && <div className="lernloop-grades">
                <p>Wie sicher warst du?</p>
                <div className="lernloop-grade-buttons">
                  <button className="button secondary" type="button" disabled={busy} onClick={() => review("again")}>Nochmal</button>
                  <button className="button secondary" type="button" disabled={busy} onClick={() => review("hard")}>Schwierig</button>
                  <button className="button" type="button" disabled={busy} onClick={() => review("good")}>Gewusst</button>
                  <button className="button secondary" type="button" disabled={busy} onClick={() => review("easy")}>Sehr sicher</button>
                </div>
              </div>}
            </>
          ) : cards.length > 0 ? (
            <div className="lernloop-empty"><div className="lernloop-check">✓</div><h3>Für jetzt bist du fertig.</h3><p>Alle fälligen Karten sind erledigt. Deine nächste Wiederholung ist am {formatDate(nextCard!.due_at)}.</p></div>
          ) : (
            <div className="lernloop-empty"><div className="lernloop-check">＋</div><h3>Dein LernLoop startet hier.</h3><p>Erstelle rechts deine ersten Lernkarten – aus deinen Notizen oder ganz von Hand.</p></div>
          )}
        </section>

        <section className="card lernloop-create">
          <div className="eyebrow">Neue Karten erstellen</div>
          <h2>Aus Notizen lernen</h2>
          <form onSubmit={generateCards}>
            <label className="field">Fach oder Thema
              <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={80} required />
            </label>
            <label className="field">Deine Notizen
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} minLength={20} maxLength={6000} rows={6} required placeholder="Füge hier deine Mitschrift, Zusammenfassung oder Lernzettel ein …" />
            </label>
            <button className="button" type="submit" disabled={busy || notes.trim().length < 20 || !subject.trim()}>{busy ? "Erstelle Vorschau …" : "✦ Lernkarten mit KI erstellen"}</button>
          </form>

          {drafts.length > 0 && <div className="lernloop-preview">
            <div className="lernloop-panel-heading"><h3>Vorschau · {drafts.length} Karten</h3><button className="button secondary" type="button" disabled={busy} onClick={saveGenerated}>Alle speichern</button></div>
            {drafts.map((card, index) => <article className="lernloop-draft" key={index}><strong>{card.question}</strong><p>{card.answer}</p></article>)}
          </div>}

          <details className="lernloop-manual">
            <summary>Eine Karte selbst erstellen</summary>
            <form onSubmit={createManual}>
              <label className="field">Frage<input value={manualQuestion} onChange={(event) => setManualQuestion(event.target.value)} maxLength={1200} required /></label>
              <label className="field">Antwort<textarea value={manualAnswer} onChange={(event) => setManualAnswer(event.target.value)} maxLength={2400} rows={3} required /></label>
              <button className="button secondary" type="submit" disabled={busy || !subject.trim()}>Karte speichern</button>
            </form>
          </details>
        </section>
      </div>
      <p className="lernloop-footnote">Deine Lernkarten sind privat und nur in deinem Konto sichtbar. LernLoop passt die Wiederholung an deine eigene Einschätzung an.</p>
      
<style jsx global>{`
.lernloop-page { padding-bottom: 72px; }
.lernloop-intro { max-width: 760px; margin-bottom: 28px; }
.lernloop-shell { padding-bottom: 30px; }
.lernloop-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 24px 0; }
.lernloop-stats .card { display: flex; flex-direction: column; gap: 5px; }
.lernloop-stat-label { color: var(--muted); font-size: .82rem; }
.lernloop-stats strong { color: var(--purple); font-size: 2rem; line-height: 1.2; }
.lernloop-stat-foot { color: var(--muted); font-size: .82rem; }
.lernloop-columns { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, .92fr); gap: 18px; align-items: start; }
.lernloop-study, .lernloop-create { min-width: 0; }
.lernloop-panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
.lernloop-panel-heading h2 { margin: 8px 0 18px; font-size: 1.55rem; }
.lernloop-count, .lernloop-subject { display: inline-flex; padding: 7px 10px; border-radius: 999px; color: #e3d8ff; background: var(--purple-soft); font-size: .8rem; }
.lernloop-question { min-height: 150px; display: flex; align-items: center; padding: 24px 4px; font-size: clamp(1.35rem, 3vw, 1.9rem); line-height: 1.4; font-weight: 750; letter-spacing: -.025em; }
.lernloop-reveal { width: 100%; }
.lernloop-answer { padding: 18px; border: 1px solid var(--border-strong); border-radius: 14px; background: rgba(167, 139, 250, .07); }
.lernloop-answer > span { color: var(--purple); font-size: .77rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.lernloop-answer p { margin-bottom: 0; color: var(--white); white-space: pre-wrap; }
.lernloop-grades { margin-top: 18px; }
.lernloop-grades > p { margin: 0 0 10px; }
.lernloop-grade-buttons { display: flex; flex-wrap: wrap; gap: 9px; }
.lernloop-grade-buttons .button { flex: 1 1 auto; }
.lernloop-empty { min-height: 310px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
.lernloop-check { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 14px; background: var(--purple-soft); color: var(--purple); font-size: 1.4rem; }
.lernloop-empty h3 { margin: 18px 0 0; }
.lernloop-create h2 { margin: 8px 0 16px; font-size: 1.55rem; }
.lernloop-preview { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
.lernloop-preview .lernloop-panel-heading { align-items: center; }
.lernloop-preview h3 { margin: 0; }
.lernloop-draft { margin-top: 10px; padding: 13px; border: 1px solid var(--border); border-radius: 12px; background: rgba(255,255,255,.02); }
.lernloop-draft p { margin: 7px 0 0; font-size: .92rem; }
.lernloop-manual { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
.lernloop-manual summary { color: #d6c8ff; cursor: pointer; font-weight: 700; }
.lernloop-manual form { margin-top: 12px; }
.lernloop-footnote { margin-top: 18px; font-size: .85rem; }
@media (max-width: 760px) {
  .lernloop-columns { grid-template-columns: 1fr; }
  .lernloop-stats { gap: 8px; }
  .lernloop-stats .card { padding: 14px 11px; }
  .lernloop-stats strong { font-size: 1.6rem; }
  .lernloop-stat-label, .lernloop-stat-foot { font-size: .73rem; }
}
@media (max-width: 440px) {
  .lernloop-stats { grid-template-columns: 1fr; }
  .lernloop-grade-buttons { display: grid; grid-template-columns: 1fr 1fr; }
  .lernloop-preview .lernloop-panel-heading { flex-direction: column; }
}
`}</style>
\n    </div>
  );
}
