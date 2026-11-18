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

const modes: { value: Mode; label: string; prompt: string; placeholder: string }[] = [
  { value: "chat", label: "Freier Chat", prompt: "Frag mich alles …", placeholder: "Schreibe eine Nachricht …" },
  { value: "worksheet", label: "Arbeitsblatt", prompt: "Erstelle ein Arbeitsblatt zu …", placeholder: "Thema, Jahrgang und gewünschte Aufgaben beschreiben …" },
  { value: "lesson_plan", label: "Unterricht planen", prompt: "Plane eine Unterrichtsstunde zu …", placeholder: "Thema, Dauer und Lernziel beschreiben …" },
  { value: "test", label: "Lernzielkontrolle", prompt: "Erstelle eine Lernzielkontrolle zu …", placeholder: "Thema, Jahrgang und Schwierigkeitsgrad beschreiben …" },
  { value: "solutions", label: "Musterlösungen", prompt: "Erstelle Musterlösungen zu …", placeholder: "Aufgaben oder Thema einfügen …" },
  { value: "parent_letter", label: "Elternbrief", prompt: "Formuliere einen Elternbrief über …", placeholder: "Anlass und wichtige Informationen beschreiben …" },
];
const suggestions: { label: string; prompt: string; mode: Mode }[] = [
  { label: "Ein Thema erklären", prompt: "Erkläre mir ein Thema verständlich und gib mir ein Beispiel: ", mode: "chat" },
  { label: "Ideen für den Unterricht", prompt: "Gib mir kreative und praktisch umsetzbare Unterrichtsideen für: ", mode: "chat" },
  { label: "Arbeitsblatt erstellen", prompt: "Erstelle ein Arbeitsblatt zu ", mode: "worksheet" },
  { label: "Unterrichtsstunde planen", prompt: "Plane eine Unterrichtsstunde zu ", mode: "lesson_plan" },
];
const solutionMarker = "[[MUSTERLÖSUNG_NUR_LEHRKRAFT]]";

export function TeacherAiChat({ initialChats }: { initialChats: TeacherChat[] }) {
  const [chats, setChats] = useState(initialChats);
  const [activeChatId, setActiveChatId] = useState(initialChats[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [lastAssistantMode, setLastAssistantMode] = useState<Mode>("chat");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [savingWorksheet, setSavingWorksheet] = useState(false);
  const [publishWorksheet, setPublishWorksheet] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const messageEnd = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? null, [chats, activeChatId]);
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const canSaveWorksheet = lastAssistantMode === "worksheet" && !!lastAssistant?.content.includes(solutionMarker);
  const selectedMode = modes.find((item) => item.value === mode) ?? modes[0];

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    setError("");
    setLastAssistantMode("chat");
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
    const selectedModeValue = mode;
    setInput("");
    setError("");
    setNotice("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    setSending(true);
    try {
      const response = await fetch("/api/teacher/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChat.id, message, mode: selectedModeValue }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Die KI konnte nicht antworten.");
      setMessages((current) => [...current, { role: "assistant", content: String(payload.answer ?? "") }]);
      setLastAssistantMode(selectedModeValue);
      setMode("chat");
    } catch (reason) {
      setMessages((current) => current.filter((item, index) => !(index === current.length - 1 && item.role === "user" && item.content === message)));
      setInput(message);
      setError(reason instanceof Error ? reason.message : "Verbindung zur Lehrer-KI fehlgeschlagen.");
    } finally {
      setSending(false);
      composerRef.current?.focus();
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
      setMessages([]);
      setMode("chat");
      setLastAssistantMode("chat");
      setNotice("");
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
      setLastAssistantMode("chat");
      setPublishWorksheet(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Arbeitsblatt konnte nicht gespeichert werden.");
    } finally {
      setSavingWorksheet(false);
    }
  }

  function chooseSuggestion(item: { prompt: string; mode: Mode }) {
    setMode(item.mode);
    setInput(item.prompt);
    composerRef.current?.focus();
  }

  return <section className="teacher-ai-shell" aria-label="Lehrer-KI Chat">
    <aside className="teacher-ai-sidebar">
      <div className="teacher-ai-brand"><span className="teacher-ai-brand-mark">S</span><span><strong>SchulWatch KI</strong><small>Dein Unterrichts-Assistent</small></span></div>
      <button type="button" className="teacher-ai-new-chat" onClick={createNewChat} disabled={!activeChat || creatingChat}>
        <span aria-hidden="true">＋</span> {creatingChat ? "Wird erstellt …" : "Neuer Chat"}
      </button>
      <div className="teacher-ai-history-title">Deine Chats</div>
      <nav className="teacher-ai-chat-list" aria-label="Deine Fach-Chats">
        {chats.map((chat) => (
          <button type="button" key={chat.id} className={"teacher-ai-chat-link" + (chat.id === activeChatId ? " active" : "")} onClick={() => { setActiveChatId(chat.id); setNotice(""); setError(""); setMode("chat"); }}>
            <span className="teacher-ai-chat-icon" aria-hidden="true">◦</span>
            <span className="teacher-ai-chat-label"><strong>{chat.title || chat.subject}</strong><small>{chat.className}{chat.grade ? " · " + chat.grade : ""}</small></span>
          </button>
        ))}
      </nav>
      <div className="teacher-ai-sidebar-footer">Fachkontext: {activeChat?.subject ?? "Nicht ausgewählt"}</div>
    </aside>

    <div className="teacher-ai-conversation">
      <header className="teacher-ai-conversation-head">
        <div className="teacher-ai-context">
          <span className="teacher-ai-context-label">FACH-CHAT</span>
          <strong>{activeChat?.subject ?? "Lehrer-KI"}</strong>
          <span>{activeChat ? activeChat.className + (activeChat.grade ? " · Jahrgang " + activeChat.grade : "") : "Dein persönlicher Assistent"}</span>
        </div>
        <span className="teacher-ai-ready"><i /> Bereit</span>
      </header>

      <div className="teacher-ai-messages" aria-live="polite">
        {loadingMessages ? <div className="teacher-ai-empty">Unterhaltung wird geladen …</div> : messages.length === 0 ? (
          <div className="teacher-ai-welcome">
            <div className="teacher-ai-welcome-mark">S</div>
            <div className="teacher-ai-welcome-eyebrow">SCHULWATCH LEHRER-KI</div>
            <h2>Was möchtest du heute machen?</h2>
            <p>Frag mich einfach alles. Ich kann erklären, Ideen entwickeln, Texte schreiben, Unterricht vorbereiten und dir bei Aufgaben helfen. Ich berücksichtige dabei dein Fach und deine Klasse.</p>
            <div className="teacher-ai-prompts">
              {suggestions.map((item) => <button type="button" key={item.label} onClick={() => chooseSuggestion(item)}>
                <span>{item.label}</span><span aria-hidden="true">↗</span>
              </button>)}
            </div>
          </div>
        ) : messages.map((message, index) => (
          <article className={"teacher-ai-message " + message.role} key={message.id ?? index}>
            {message.role === "assistant" && <span className="teacher-ai-message-avatar" aria-hidden="true">S</span>}
            <div className="teacher-ai-message-body">
              {message.role === "user" && <small>Du</small>}
              <div className="teacher-ai-message-content">{message.content.replace(solutionMarker, "—— Musterlösung (nur für Lehrkräfte) ——")}</div>
            </div>
          </article>
        ))}
        {sending && <article className="teacher-ai-message assistant"><span className="teacher-ai-message-avatar" aria-hidden="true">S</span><div className="teacher-ai-message-body"><small>SchulWatch KI</small><div className="teacher-ai-typing"><i /><i /><i /> Denkt nach …</div></div></article>}
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

      <div className="teacher-ai-composer-wrap">
        <form className="teacher-ai-composer" onSubmit={send}>
          <textarea ref={composerRef} value={input} onChange={(event) => setInput(event.target.value)} rows={1} maxLength={4000}
            placeholder={selectedMode.placeholder}
            aria-label="Nachricht an die Lehrer-KI"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }} disabled={sending} />
          <div className="teacher-ai-composer-tools">
            <label className="teacher-ai-tool-picker" aria-label="Optionales Werkzeug auswählen">
              <span aria-hidden="true">＋</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={sending}>
                {modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <span className="teacher-ai-enter-hint">Enter zum Senden · Shift + Enter für neue Zeile</span>
            <button className="teacher-ai-send" type="submit" aria-label="Nachricht senden" disabled={sending || !input.trim()}>{sending ? "…" : "↑"}</button>
          </div>
        </form>
        <p className="teacher-ai-footnote">SchulWatch KI kann Fehler machen. Bitte prüfe wichtige Inhalte, bevor du sie im Unterricht verwendest.</p>
      </div>
    </div>
  </section>;
}
