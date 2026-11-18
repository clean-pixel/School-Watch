"use client";

import { useMemo, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatSession = { id: string; title: string; messages: ChatMessage[] };

const suggestions = [
  { label: "Etwas verständlich erklären", text: "Erkläre mir bitte verständlich: " },
  { label: "Bei einer Aufgabe helfen", text: "Hilf mir Schritt für Schritt bei dieser Aufgabe: " },
  { label: "Für eine Klassenarbeit lernen", text: "Erstelle mir einen Lernplan und übe mit mir für: " },
  { label: "Ideen und Texte entwickeln", text: "Hilf mir, Ideen zu sammeln und einen Text zu schreiben über: " },
];

function titleFromMessage(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.length > 34 ? cleaned.slice(0, 34) + "…" : cleaned || "Neuer Chat";
}

export function LearningTutor({ userRole }: { userRole: string }) {
  const [chats, setChats] = useState<ChatSession[]>([{ id: "start", title: "Neuer Chat", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState("start");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? chats[0], [chats, activeChatId]);
  const isStudent = userRole === "student";

  function newChat() {
    if (busy) return;
    const chat = { id: "chat-" + Date.now().toString(), title: "Neuer Chat", messages: [] as ChatMessage[] };
    setChats((current) => [chat, ...current]);
    setActiveChatId(chat.id);
    setInput("");
    setError("");
    composerRef.current?.focus();
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || busy || !activeChat) return;
    const chatId = activeChat.id;
    const conversation: ChatMessage[] = [...activeChat.messages, { role: "user", content }];
    setChats((current) => current.map((chat) => chat.id === chatId
      ? { ...chat, title: chat.messages.length === 0 ? titleFromMessage(content) : chat.title, messages: conversation }
      : chat));
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
      if (!response.ok) throw new Error(payload.error || "Die KI konnte nicht antworten.");
      setChats((current) => current.map((chat) => chat.id === chatId
        ? { ...chat, messages: [...conversation, { role: "assistant", content: String(payload.answer ?? "") }] }
        : chat));
    } catch (err) {
      setChats((current) => current.map((chat) => chat.id === chatId ? { ...chat, messages: activeChat.messages } : chat));
      setInput(content);
      setError(err instanceof Error ? err.message : "Verbindung zur SchulWatch KI fehlgeschlagen.");
    } finally {
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  return <section className="teacher-ai-shell" aria-label="Chat mit SchulWatch KI">
    <aside className="teacher-ai-sidebar">
      <div className="teacher-ai-brand">
        <span className="teacher-ai-brand-mark">S</span>
        <span><strong>SchulWatch KI</strong><small>{isStudent ? "Dein Lern-Assistent" : "Dein Schul-Assistent"}</small></span>
      </div>
      <button type="button" className="teacher-ai-new-chat" onClick={newChat} disabled={busy}>
        <span aria-hidden="true">＋</span> Neuer Chat
      </button>
      <div className="teacher-ai-history-title">Deine Chats</div>
      <nav className="teacher-ai-chat-list" aria-label="Chatverlauf">
        {chats.map((chat) => (
          <button type="button" key={chat.id}
            className={"teacher-ai-chat-link" + (chat.id === activeChatId ? " active" : "")}
            disabled={busy}
            onClick={() => { setActiveChatId(chat.id); setError(""); }}>
            <span className="teacher-ai-chat-icon" aria-hidden="true">◦</span>
            <span className="teacher-ai-chat-label"><strong>{chat.title}</strong><small>{chat.messages.length ? chat.messages.length + " Nachrichten" : "Neues Gespräch"}</small></span>
          </button>
        ))}
      </nav>
      <div className="teacher-ai-sidebar-footer">Deine Unterhaltungen bleiben während dieser Sitzung geöffnet.</div>
    </aside>

    <div className="teacher-ai-conversation">
      <header className="teacher-ai-conversation-head">
        <div className="teacher-ai-context">
          <span className="teacher-ai-context-label">{isStudent ? "LERN-ASSISTENT" : "SCHUL-ASSISTENT"}</span>
          <strong>{activeChat?.title ?? "Neuer Chat"}</strong>
          <span>Freier Chat · Stelle jede passende Frage</span>
        </div>
        <span className="teacher-ai-ready"><i /> Bereit</span>
      </header>

      <div className="teacher-ai-messages" aria-live="polite">
        {!activeChat?.messages.length ? (
          <div className="teacher-ai-welcome">
            <div className="teacher-ai-welcome-mark">S</div>
            <div className="teacher-ai-welcome-eyebrow">SCHULWATCH KI</div>
            <h2>{isStudent ? "Was möchtest du heute wissen?" : "Wobei kann ich dich unterstützen?"}</h2>
            <p>{isStudent
              ? "Frag einfach drauflos. Ich kann dir Themen erklären, bei Hausaufgaben helfen und mit dir für Klassenarbeiten üben."
              : "Stelle Fragen, lass dir Inhalte erklären, entwickle Ideen oder formuliere Texte. Du kannst ganz normal chatten."}</p>
            <div className="teacher-ai-prompts">
              {suggestions.map((suggestion) => <button type="button" key={suggestion.label}
                onClick={() => { setInput(suggestion.text); composerRef.current?.focus(); }}>
                <span>{suggestion.label}</span><span aria-hidden="true">↗</span>
              </button>)}
            </div>
          </div>
        ) : activeChat.messages.map((message, index) => (
          <article className={"teacher-ai-message " + message.role} key={index}>
            {message.role === "assistant" && <span className="teacher-ai-message-avatar" aria-hidden="true">S</span>}
            <div className="teacher-ai-message-body">
              {message.role === "user" && <small>Du</small>}
              <div className="teacher-ai-message-content">{message.content}</div>
            </div>
          </article>
        ))}
        {busy && <article className="teacher-ai-message assistant">
          <span className="teacher-ai-message-avatar" aria-hidden="true">S</span>
          <div className="teacher-ai-message-body"><small>SchulWatch KI</small><div className="teacher-ai-typing"><i /><i /><i /> Denkt nach …</div></div>
        </article>}
        <div />
      </div>

      {error && <div className="notice teacher-ai-notice" role="alert">{error}</div>}
      <div className="teacher-ai-composer-wrap">
        <form className="teacher-ai-composer" onSubmit={send}>
          <textarea ref={composerRef} value={input} onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1} maxLength={2500} placeholder="Schreibe eine Nachricht …"
            aria-label="Deine Nachricht an SchulWatch KI" disabled={busy} />
          <div className="teacher-ai-composer-tools">
            <span className="teacher-ai-enter-hint">Enter zum Senden · Shift + Enter für neue Zeile</span>
            <button className="teacher-ai-send" type="submit" aria-label="Nachricht senden" disabled={busy || !input.trim()}>{busy ? "…" : "↑"}</button>
          </div>
        </form>
        <p className="teacher-ai-footnote">{isStudent
          ? "Die KI kann Fehler machen. Prüfe wichtige Antworten und gib keine privaten Daten ein. Chats werden nicht dauerhaft gespeichert."
          : "Die KI kann Fehler machen. Gib keine vertraulichen Schüler- oder Personaldaten ein."}</p>
      </div>
    </div>
  </section>;
}
