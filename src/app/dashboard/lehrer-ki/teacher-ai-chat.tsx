"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type TeacherChat = {
  id: string;
  title: string;
  subject: string;
  classId: string;
  className: string;
  grade: string | null;
  createdAt: string;
  isDefault: boolean;
};

type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };
type Mode = "chat" | "worksheet" | "lesson_plan" | "test" | "solutions" | "parent_letter";

const modes: { value: Mode; label: string; prompt: string }[] = [
  { value: "chat", label: "Normaler Chat", prompt: "Frage stellen" },
  { value: "worksheet", label: "Arbeitsblatt erstellen", prompt: "Erstelle ein Arbeitsblatt zu …" },
  { value: "lesson_plan", label: "Unterricht planen", prompt: "Plane eine Unterrichtsstunde zu …" },
  { value: "test", label: "Lernzielkontrolle", prompt: "Erstelle eine Lernzielkontrolle zu …" },
  { value: "solutions", label: "Musterlösungen", prompt: "Erstelle Musterlösungen zu …" },
  { value: "parent_letter", label: "Elternbrief", prompt: "Formuliere einen Elternbrief über …" },
];
const solutionMarker = "[[MUSTERLÖSUNG_NUR_LEHRKRAFT]]";

export function TeacherAiChat({ initialChats }: { initialChats: TeacherChat[] }) {
  const [chats, setChats] = useState(initialChats);
  const [activeChatId, setActiveChatId] = useState(initialChats[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [savingWorksheet, setSavingWorksheet] = useState(false);
  const [publishWorksheet, setPublishWorksheet] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const messageEnd = useRef<HTMLDivElement>(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? null, [chats, activeChatId]);
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const canSaveWorksheet = mode === "worksheet" && !!lastAssistant?.content.includes(solutionMarker);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setError("");
    fetch("/api/teacher/chats/" + activeChatId, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Chat konnte nicht geladen werden.");
        if (!cancelled) setMessages((payload.messages ?? []).map((message: ChatMessage) => ({ ...message })));
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Chat konnte nicht geladen werden."); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeChatId]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !activeChat || sending) return;
    const selectedMode = mode;
    setInput("");
    setError("");
    setNotice("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    setSending(true);
    try {
      const response = await fetch("/api/teacher/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChat.id, message, mode: selectedMode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die KI konnte nicht antworten.");
      setMessages((current) => [...current, { role: "assistant", content: String(payload.answer ?? "") }]);
    } catch (reason) {
      setMessages((current) => current.filter((item, index) => !(index === current.length - 1 && item.role === "user" && item.content === message)));
      setInput(message);
      setError(reason instanceof Error ? reason.message : "Verbindung zur Lehrer-KI fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  }

  async function createNewChat() {
    if (!activeChat || creatingChat) return;
    setCreatingChat(true);
    setError("");
    try {
      const response = await fetch("/api/teacher/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: activeChat.classId, subject: activeChat.subject }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.chat) throw new Error(payload.error || "Neuer Chat konnte nicht erstellt werden.");
      const nextChat: TeacherChat = {
        ...payload.chat,
        className: activeChat.className,
        grade: activeChat.grade,
        createdAt: payload.chat.created_at,
        isDefault: false,
      };
      setChats((current) => [nextChat, ...current]);
      setActiveChatId(nextChat.id);
      setMode("chat");
      setNotice("Neuer Chat für " + nextChat.subject + " wurde angelegt.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Neuer Chat konnte nicht erstellt werden.");
    } finally {
      setCreatingChat(false);
    }
  }

  async function saveWorksheet() {
    if (!activeChat || !lastAssistant || !canSaveWorksheet || savingWorksheet) return;
    const studentContent = lastAssistant.content.split(solutionMarker)[0].trim();
    const firstLine = studentContent.split("\n").map((line) => line.replace(/^#+\s*/, "").trim()).find(Boolean);
    const title = (firstLine || "Arbeitsblatt " + activeChat.subject).slice(0, 160);
    setSavingWorksheet(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/teacher/worksheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeChat.id,
          title,
          topic: activeChat.subject,
          content: lastAssistant.content,
          publish: publishWorksheet,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Arbeitsblatt konnte nicht gespeichert werden.");
      setNotice(publishWorksheet
        ? "Arbeitsblatt gespeichert und für die Klasse freigegeben."
        : "Arbeitsblatt gespeichert. Es ist zunächst nur für dich sichtbar.");
      setMode("chat");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Arbeitsblatt konnte nicht gespeichert werden.");
    } finally {
      setSavingWorksheet(false);
    }
  }

  return <section className="teacher-ai-shell" aria-label="Lehrer-KI Chat">
    <aside className="teacher-ai-sidebar">
      <div className="teacher-ai-sidebar-head">
        <div><strong>Deine Fach-Chats</strong><small>Automatisch zugeordnet</small></div>
        <button type="button" className="button secondary compact" onClick={createNewChat} disabled={!activeChat || creatingChat}>
          {creatingChat ? "…" : "+ Neuer Chat"}
        </button>
      </div>
      {chats.map((chat) => (
        <button type="button" key={chat.id} className={"teacher-ai-chat-link" + (chat.id === activeChatId ? " active" : "")} onClick={() => { setActiveChatId(chat.id); setNotice(""); setError(""); }}>
          <span className="teacher-ai-chat-symbol">{chat.subject.slice(0, 1).toUpperCase()}</span>
          <span className="teacher-ai-chat-label"><strong>{chat.subject}</strong><small>{chat.className}{chat.grade ? " · " + chat.grade : ""}</small></span>
          {chat.isDefault && <span className="teacher-ai-default" title="Automatisch erstellt">Auto</span>}
        </button>
      ))}
    </aside>

    <div className="teacher-ai-conversation">
      <header className="teacher-ai-conversation-head">
        <div>
          <strong>{activeChat?.subject ?? "Fach-Chat"}</strong>
          <span>{activeChat ? activeChat.className + (activeChat.grade ? " · Jahrgang " + activeChat.grade : "") : ""}</span>
        </div>
        <span className="teacher-ai-ready"><i /> Bereit</span>
      </header>

      <div className="teacher-ai-messages" aria-live="polite">
        {loadingMessages ? <div className="teacher-ai-empty">Chat wird geladen …</div> : messages.length === 0 ? (
          <div className="teacher-ai-empty">
            <div className="chat-avatar">S</div>
            <h2>Womit kann ich dich unterstützen?</h2>
            <p>Dieser Chat ist nur für {activeChat?.subject ?? "dieses Fach"} in {activeChat?.className ?? "dieser Klasse"}.</p>
            <div className="teacher-ai-prompts">
              {modes.slice(1, 5).map((item) => <button type="button" key={item.value} onClick={() => { setMode(item.value); setInput(item.prompt); }}>{item.label} <span>↗</span></button>)}
            </div>
          </div>
        ) : messages.map((message, index) => (
          <article className={"teacher-ai-message " + message.role} key={message.id ?? index}>
            {message.role === "assistant" && <span className="teacher-ai-message-avatar">S</span>}
            <div className="teacher-ai-bubble">
              <small>{message.role === "assistant" ? "SchulWatch Lehrer-KI" : "Du"}</small>
              <div className="teacher-ai-message-content">{message.content.replace(solutionMarker, "—— Musterlösung (nur für Lehrkräfte) ——")}</div>
            </div>
          </article>
        ))}
        {sending && <article className="teacher-ai-message assistant"><span className="teacher-ai-message-avatar">S</span><div className="teacher-ai-bubble"><small>SchulWatch Lehrer-KI</small><div className="teacher-ai-typing">Schreibt …</div></div></article>}
        <div ref={messageEnd} />
      </div>

      {canSaveWorksheet && <div className="teacher-ai-save-row">
        <label><input type="checkbox" checked={publishWorksheet} onChange={(event) => setPublishWorksheet(event.target.checked)} /> Direkt für diese Klasse freigeben</label>
        <button className="button" type="button" onClick={saveWorksheet} disabled={savingWorksheet}>
          {savingWorksheet ? "Speichert …" : "Arbeitsblatt speichern"}
        </button>
        <span>Die Musterlösung wird nicht an die Klasse weitergegeben.</span>
      </div>}
      {notice && <div className="notice teacher-ai-notice" role="status">{notice}</div>}
      {error && <div className="notice teacher-ai-notice" role="alert">{error}</div>}

      <form className="teacher-ai-composer" onSubmit={send}>
        <select aria-label="KI-Aufgabe" value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={sending}>
          {modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={4000}
          placeholder="Schreibe deine Frage oder deinen Arbeitsauftrag …"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} disabled={sending} />
        <button className="button" disabled={sending || !input.trim()}>{sending ? "…" : "Senden ↑"}</button>
      </form>
      <p className="teacher-ai-footnote">KI-Ergebnisse sind Entwürfe. Bitte fachlich prüfen, bevor du sie verteilst oder veröffentlichst.</p>
    </div>
  </section>;
}
