"use client";

import { useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Erklär mir Brüche ganz einfach.",
  "Hilf mir beim Lernen für eine Klassenarbeit.",
  "Was ist der Unterschied zwischen Klima und Wetter.",
];

export function LearningTutor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy) return;

    const conversation: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(conversation);
    setInput("");
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/learning/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation.slice(-12) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die Lern-KI konnte nicht antworten.");
      setMessages([...conversation, { role: "assistant", content: String(payload.answer ?? "") }]);
    } catch (err) {
      setMessages(messages);
      setInput(content);
      setError(err instanceof Error ? err.message : "Verbindung zur Lern-KI fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function startNewChat() {
    if (busy) return;
    setMessages([]);
    setInput("");
    setError("");
  }

  return <section className="learning-chat card" aria-label="Chat mit der Lern-KI">
    <div className="learning-chat-header">
      <div>
        <div className="eyebrow">SchulWatch Lern-KI</div>
        <strong>Dein Lern-Chat</strong>
        <span className="chat-online"><i /> Bereit zum Helfen</span>
      </div>
      <button type="button" className="button secondary" onClick={startNewChat} disabled={busy}>Neuer Chat</button>
    </div>

    <div className="learning-chat-messages" aria-live="polite">
      {messages.length === 0 ? <div className="chat-welcome">
        <div className="chat-avatar">S</div>
        <h2>Hey! Was möchtest du lernen?</h2>
        <p>Frag mich etwas oder wähle einen Vorschlag aus. Ich erkläre es verständlich und in deinem Tempo.</p>
        <div className="chat-suggestions">
          {suggestions.map((suggestion) => <button type="button" className="chat-suggestion" key={suggestion} onClick={() => setInput(suggestion)}>{suggestion} <span>↗</span></button>)}
        </div>
      </div> : messages.map((message, index) => <div className={"chat-message " + message.role} key={index}>
        {message.role === "assistant" && <div className="chat-avatar small">S</div>}
        <div className="chat-bubble">
          <div className="chat-speaker">{message.role === "assistant" ? "SchulWatch Lern-KI" : "Du"}</div>
          <p>{message.content}</p>
        </div>
      </div>)}
      {busy && <div className="chat-message assistant"><div className="chat-avatar small">S</div><div className="chat-bubble"><div className="chat-speaker">SchulWatch Lern-KI</div><p className="chat-typing">Schreibt eine Antwort …</p></div></div>}
    </div>

    {error && <div className="notice" role="alert">{error}</div>}
    <form className="chat-composer" onSubmit={send}>
      <textarea
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        rows={2}
        maxLength={2500}
        placeholder="Schreib deine Frage …"
        aria-label="Deine Nachricht"
        disabled={busy}
      />
      <button className="button chat-send" disabled={busy || !input.trim()} aria-label="Nachricht senden">{busy ? "…" : "Senden ↑"}</button>
    </form>
    <p className="chat-disclaimer">Die Antworten können Fehler enthalten. Gib keine Passwörter oder privaten Daten ein. Dein Chat wird hier nicht dauerhaft gespeichert.</p>
  </section>;
}
