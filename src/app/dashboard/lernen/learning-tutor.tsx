"use client";

import { useMemo, useRef, useState } from "react";

type GeneratedFile = { name: string; format: "md" | "txt" | "csv" | "html" | "json"; content: string };
type ProposedAction =
  | { type: "create_class"; name: string; grade?: string | null; subjects: string[] }
  | { type: "add_subjects"; className: string; subjects: string[] }
  | { type: "assign_teacher"; className: string; subject: string; teacherId: string }
  | { type: "create_timetable"; className: string; entries: Array<{ weekday: number; startsAt: string; endsAt: string; subject: string; room?: string | null; weekType: "both" | "A" | "B" }> };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  files?: GeneratedFile[];
  actions?: ProposedAction[];
  actionResult?: string;
  actionsApplied?: boolean;
};
type ChatSession = { id: string; title: string; messages: ChatMessage[] };

const suggestions = [
  { label: "Etwas verständlich erklären", text: "Erkläre mir bitte verständlich: " },
  { label: "Bei einer Aufgabe helfen", text: "Hilf mir Schritt für Schritt bei dieser Aufgabe: " },
  { label: "Für eine Klassenarbeit lernen", text: "Erstelle mir einen Lernplan und übe mit mir für: " },
  { label: "Eine Datei erstellen", text: "Erstelle mir eine herunterladbare Datei mit folgendem Inhalt: " },
];

const weekdays = ["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

function titleFromMessage(message: string) {
  const cleaned = message.replace(/\s+/g, " ").trim();
  return cleaned.length > 34 ? cleaned.slice(0, 34) + "…" : cleaned || "Neuer Chat";
}

function downloadGeneratedFile(file: GeneratedFile) {
  const mimeTypes: Record<GeneratedFile["format"], string> = {
    md: "text/markdown;charset=utf-8",
    txt: "text/plain;charset=utf-8",
    csv: "text/csv;charset=utf-8",
    html: "text/html;charset=utf-8",
    json: "application/json;charset=utf-8",
  };
  const extension = "." + file.format;
  const safeBaseName = file.name.replace(/[\\/:*?"<>|]/g, "_").trim() || "SchulWatch-Datei";
  const fileName = safeBaseName.toLowerCase().endsWith(extension) ? safeBaseName : safeBaseName + extension;
  const blob = new Blob(["\uFEFF", file.content], { type: mimeTypes[file.format] });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function actionDescription(action: ProposedAction) {
  if (action.type === "create_class") {
    return "Klasse " + action.name + (action.grade ? " (Jahrgang " + action.grade + ")" : "") +
      (action.subjects.length ? " · Fächer: " + action.subjects.join(", ") : "");
  }
  if (action.type === "add_subjects") return "Fächer für " + action.className + " ergänzen: " + action.subjects.join(", ");
  if (action.type === "assign_teacher") return "Lehrkraft einem Fach zuordnen: " + action.className + " · " + action.subject;
  if (action.type === "create_timetable") return "Stundenplan für " + action.className + " · " + action.entries.length + " Stunden";
  return "Schuländerung";
}

export function LearningTutor({ userRole }: { userRole: string }) {
  const [chats, setChats] = useState<ChatSession[]>([{ id: "start", title: "Neuer Chat", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState("start");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? chats[0], [chats, activeChatId]);
  const isStudent = userRole === "student";
  const canApplyActions = userRole === "teacher" || userRole === "school_admin";

  function newChat() {
    if (busy || actionBusy) return;
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
        body: JSON.stringify({ messages: conversation.slice(-12).map(({ role, content: messageContent }) => ({ role, content: messageContent })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die KI konnte nicht antworten.");
      setChats((current) => current.map((chat) => chat.id === chatId
        ? {
            ...chat,
            messages: [...conversation, {
              role: "assistant",
              content: String(payload.answer ?? "Ich konnte keine Antwort erstellen."),
              files: Array.isArray(payload.files) ? payload.files : [],
              actions: Array.isArray(payload.actions) ? payload.actions : [],
            }],
          }
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

  async function applyActions(chatId: string, messageIndex: number, actions: ProposedAction[]) {
    if (!canApplyActions || !actions.length || actionBusy) return;
    setActionBusy(true);
    setError("");
    try {
      const response = await fetch("/api/learning/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die Änderungen konnten nicht gespeichert werden.");
      setChats((current) => current.map((chat) => chat.id === chatId
        ? { ...chat, messages: chat.messages.map((message, index) => index === messageIndex
            ? { ...message, actionResult: String(payload.summary || "Änderungen verarbeitet."), actionsApplied: true }
            : message) }
        : chat));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Die Änderungen konnten nicht gespeichert werden.");
    } finally {
      setActionBusy(false);
    }
  }

  return <section className="teacher-ai-shell" aria-label="Chat mit SchulWatch KI">
    <aside className="teacher-ai-sidebar">
      <div className="teacher-ai-brand">
        <span className="teacher-ai-brand-mark">S</span>
        <span><strong>SchulWatch KI</strong><small>{isStudent ? "Dein Lern-Assistent" : "Dein Schul-Assistent"}</small></span>
      </div>
      <button type="button" className="teacher-ai-new-chat" onClick={newChat} disabled={busy || actionBusy}>
        <span aria-hidden="true">＋</span> Neuer Chat
      </button>
      <div className="teacher-ai-history-title">Deine Chats</div>
      <nav className="teacher-ai-chat-list" aria-label="Chatverlauf">
        {chats.map((chat) => (
          <button type="button" key={chat.id}
            className={"teacher-ai-chat-link" + (chat.id === activeChatId ? " active" : "")}
            disabled={busy || actionBusy}
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
          <span>Freier Chat · Dateien, Planung und Schulaufgaben</span>
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
              ? "Frag einfach drauflos. Ich kann dir Themen erklären, bei Hausaufgaben helfen und Lernmaterialien als Datei erstellen."
              : "Stelle Fragen, erstelle Dateien, entwirf Stundenpläne und bereite Klassen- und Fachstrukturen vor. Änderungen werden erst nach deiner Bestätigung gespeichert."}</p>
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
              {message.files && message.files.length > 0 && <div className="ai-generated-files">
                <strong>Erstellte Dateien</strong>
                {message.files.map((file, fileIndex) => (
                  <button type="button" className="button secondary" key={fileIndex}
                    onClick={() => downloadGeneratedFile(file)}>
                    ↓ {file.name}
                  </button>
                ))}
              </div>}
              {message.actions && message.actions.length > 0 && <div className="ai-proposed-actions">
                <strong>Vorgeschlagene Änderungen</strong>
                <ul>{message.actions.map((action, actionIndex) => <li key={actionIndex}>{actionDescription(action)}</li>)}</ul>
                {canApplyActions && !message.actionsApplied && <button type="button" className="button"
                  disabled={actionBusy || busy}
                  onClick={() => applyActions(activeChat.id, index, message.actions ?? [])}>
                  {actionBusy ? "Speichere …" : "Änderungen übernehmen"}
                </button>}
                {!canApplyActions && <small>Diese Änderungen können nur von der Schulleitung oder einer berechtigten Lehrkraft übernommen werden.</small>}
              </div>}
              {message.actionResult && <div className="notice" role="status">{message.actionResult}</div>}
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
            rows={1} maxLength={5000} placeholder="Schreibe eine Nachricht …"
            aria-label="Deine Nachricht an SchulWatch KI" disabled={busy || actionBusy} />
          <div className="teacher-ai-composer-tools">
            <span className="teacher-ai-enter-hint">Enter zum Senden · Shift + Enter für neue Zeile</span>
            <button className="teacher-ai-send" type="submit" aria-label="Nachricht senden" disabled={busy || actionBusy || !input.trim()}>{busy ? "…" : "↑"}</button>
          </div>
        </form>
        <p className="teacher-ai-footnote">{isStudent
          ? "Die KI kann Fehler machen. Prüfe wichtige Antworten und gib keine privaten Daten ein. Chats werden nicht dauerhaft gespeichert."
          : "Dateien kannst du herunterladen. Änderungen an Klassen und Stundenplänen werden nur nach deiner Bestätigung gespeichert. Gib keine vertraulichen Schüler- oder Personaldaten ein."}</p>
      </div>
    </div>
  </section>;
}
