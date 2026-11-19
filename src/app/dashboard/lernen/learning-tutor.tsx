"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type GeneratedFile = { name: string; format: "md" | "txt" | "csv" | "html" | "json"; content: string };
type ProposedAction =
  | { type: "create_class"; name: string; grade?: string | null; subjects: string[] }
  | { type: "add_subjects"; className: string; subjects: string[] }
  | { type: "assign_teacher"; className: string; subject: string; teacherId: string }
  | { type: "create_timetable"; className: string; entries: Array<{ weekday: number; startsAt: string; endsAt: string; subject: string; room?: string | null; weekType: "both" | "A" | "B" }> };
type ImageAttachment = { path: string; preview: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
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

function readMathGroup(source: string, start: number): { value: string; next: number } {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index++;
  if (source[index] !== "{") {
    return { value: source[index] ?? "", next: Math.min(index + 1, source.length) };
  }

  let depth = 0;
  const valueStart = index + 1;
  for (; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") {
      depth--;
      if (depth === 0) return { value: source.slice(valueStart, index), next: index + 1 };
    }
  }
  return { value: source.slice(valueStart), next: source.length };
}

function renderMathExpression(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let plain = "";
  let index = 0;
  const flush = () => {
    if (plain) {
      nodes.push(plain);
      plain = "";
    }
  };

  while (index < source.length) {
    const char = source[index];

    if (char === "^" || char === "_") {
      flush();
      const group = readMathGroup(source, index + 1);
      nodes.push(char === "^"
        ? <sup key={"sup-" + index}>{renderMathExpression(group.value)}</sup>
        : <sub key={"sub-" + index}>{renderMathExpression(group.value)}</sub>);
      index = group.next;
      continue;
    }

    if (char === "{") {
      const group = readMathGroup(source, index);
      flush();
      nodes.push(<span key={"group-" + index}>{renderMathExpression(group.value)}</span>);
      index = group.next;
      continue;
    }

    if (char === "\\") {
      if (source[index + 1] === "\\") {
        plain += " ";
        index += 2;
        continue;
      }
      const commandMatch = source.slice(index + 1).match(/^[a-zA-Z]+|^[,;!]/);
      if (!commandMatch) {
        plain += source[index + 1] ?? "";
        index += 2;
        continue;
      }
      const command = commandMatch[0];
      index += command.length + 1;
      const symbols: Record<string, string> = {
        cdot: "·", times: "×", div: "÷", pm: "±", le: "≤", leq: "≤",
        ge: "≥", geq: "≥", neq: "≠", ne: "≠", approx: "≈", pi: "π",
        sum: "∑", infty: "∞", rightarrow: "→", to: "→", percent: "%",
        quad: "  ", qquad: "    ", ",": " ", ";": " ", "!": "",
        alpha: "α", beta: "β", gamma: "γ", Delta: "Δ",
      };

      if (command === "frac") {
        const numerator = readMathGroup(source, index);
        const denominator = readMathGroup(source, numerator.next);
        flush();
        nodes.push(
          <span className="teacher-ai-math-fraction" key={"frac-" + index}>
            <span>{renderMathExpression(numerator.value)}</span>
            <span>{renderMathExpression(denominator.value)}</span>
          </span>
        );
        index = denominator.next;
        continue;
      }
      if (command === "sqrt" || command === "boxed" || command === "text") {
        const group = readMathGroup(source, index);
        flush();
        const rendered = renderMathExpression(group.value);
        nodes.push(command === "sqrt"
          ? <span key={"sqrt-" + index}>√<span className="teacher-ai-math-radicand">{rendered}</span></span>
          : command === "boxed"
            ? <span className="teacher-ai-math-box" key={"boxed-" + index}>{rendered}</span>
            : <span key={"text-" + index}>{rendered}</span>);
        index = group.next;
        continue;
      }
      if (command === "left" || command === "right") continue;
      if (symbols[command] !== undefined) {
        plain += symbols[command];
        continue;
      }
      plain += command;
      continue;
    }

    if (char === "}") {
      index++;
      continue;
    }

    plain += char;
    index++;
  }

  flush();
  return nodes;
}

function renderTextSegment(source: string, keyPrefix: string): ReactNode[] {
  const backtick = String.fromCharCode(96);
  return source.split(/(\*\*[^*\n]+\*\*|\x60[^\x60\n]+\x60)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={keyPrefix + "-bold-" + index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith(backtick) && part.endsWith(backtick)) {
      return <code key={keyPrefix + "-code-" + index}>{part.slice(1, -1)}</code>;
    }
    return <span key={keyPrefix + "-text-" + index}>{part}</span>;
  });
}

function renderChatContent(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const mathPattern = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = mathPattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderTextSegment(source.slice(lastIndex, match.index), "segment-" + key++));
    }
    const formula = match[1] ?? match[2] ?? match[3] ?? "";
    const isDisplay = match[1] !== undefined || match[2] !== undefined;
    nodes.push(isDisplay
      ? <div className="teacher-ai-math-block" key={"math-block-" + key++}>{renderMathExpression(formula)}</div>
      : <span className="teacher-ai-math-inline" key={"math-inline-" + key++}>{renderMathExpression(formula)}</span>);
    lastIndex = mathPattern.lastIndex;
  }

  if (lastIndex < source.length) {
    nodes.push(...renderTextSegment(source.slice(lastIndex), "segment-" + key));
  }
  return nodes.length ? nodes : [source];
}

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


async function prepareImage(file: File): Promise<{ file: File; preview: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Bitte wähle eine Bilddatei aus.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Das Bild konnte nicht vorbereitet werden.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Das Bild konnte nicht komprimiert werden.")), "image/jpeg", 0.82);
  });
  if (blob.size > 4 * 1024 * 1024) throw new Error("Das Bild ist zu groß. Bitte wähle ein kleineres Foto.");
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Bildvorschau fehlgeschlagen."));
    reader.onerror = () => reject(new Error("Bildvorschau fehlgeschlagen."));
    reader.readAsDataURL(blob);
  });
  return {
    file: new File([blob], "schoolwatch-" + crypto.randomUUID() + ".jpg", { type: "image/jpeg" }),
    preview,
  };
}

function speakMessage(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  window.speechSynthesis.speak(utterance);
}

export function LearningTutor({ userRole }: { userRole: string }) {
  const [chats, setChats] = useState<ChatSession[]>([{ id: "start", title: "Neuer Chat", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState("start");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedImages, setSelectedImages] = useState<ImageAttachment[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
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
    const attachments = [...selectedImages];
    const typedContent = input.trim();
    const content = typedContent || (attachments.length ? "Bitte analysiere das angehängte Foto und hilf mir damit." : "");
    if (!content || busy || uploadingImages || transcribing || recording || !activeChat) return;
    const chatId = activeChat.id;
    const conversation: ChatMessage[] = [...activeChat.messages, { role: "user", content, images: attachments }];
    setChats((current) => current.map((chat) => chat.id === chatId
      ? { ...chat, title: chat.messages.length === 0 ? titleFromMessage(content) : chat.title, messages: conversation }
      : chat));
    setInput("");
    setSelectedImages([]);
    setError("");
    setBusy(true);

    try {
      const requestMessages = conversation.slice(-12).map((message, index, allMessages) => ({
        role: message.role,
        content: message.content,
        ...(index === allMessages.length - 1 && message.images?.length
          ? { images: message.images.map((image) => image.path) }
          : {}),
      }));
      const response = await fetch("/api/learning/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
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
      setInput(typedContent);
      setSelectedImages(attachments);
      setError(err instanceof Error ? err.message : "Verbindung zur SchulWatch KI fehlgeschlagen.");
    } finally {
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  async function selectImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (selectedImages.length + files.length > 3) {
      setError("Du kannst höchstens drei Bilder gleichzeitig anhängen.");
      return;
    }
    setError("");
    setUploadingImages(true);
    const uploadedPaths: string[] = [];
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Bitte melde dich erneut an, bevor du ein Foto hochlädst.");
      const attachments: ImageAttachment[] = [];
      for (const originalFile of files) {
        const prepared = await prepareImage(originalFile);
        const path = user.id + "/" + crypto.randomUUID() + ".jpg";
        const { error: uploadError } = await supabase.storage.from("ai-chat-uploads").upload(path, prepared.file, {
          contentType: "image/jpeg",
          upsert: false,
        });
        if (uploadError) throw new Error("Das Foto konnte nicht hochgeladen werden. " + uploadError.message);
        uploadedPaths.push(path);
        attachments.push({ path, preview: prepared.preview });
      }
      setSelectedImages((current) => [...current, ...attachments]);
    } catch (cause) {
      if (uploadedPaths.length) await createClient().storage.from("ai-chat-uploads").remove(uploadedPaths);
      setError(cause instanceof Error ? cause.message : "Foto-Upload fehlgeschlagen.");
    } finally {
      setUploadingImages(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Dein Browser unterstützt keine Mikrofonaufnahme. Nutze bitte die Texteingabe.");
      return;
    }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setRecording(false);
        setError("Die Mikrofonaufnahme ist fehlgeschlagen. Prüfe die Mikrofonberechtigung.");
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setRecording(false);
        if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];
        if (!blob.size) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", new File([blob], "schulwatch-aufnahme.webm", { type: blob.type || "audio/webm" }));
          const response = await fetch("/api/learning/transcribe", { method: "POST", body: form });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Sprache konnte nicht erkannt werden.");
          const transcript = String(payload.transcript ?? "").trim();
          if (!transcript) throw new Error("Es wurde keine Sprache erkannt.");
          setInput((current) => current.trim() ? current.trim() + " " + transcript : transcript);
          composerRef.current?.focus();
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "Spracheingabe fehlgeschlagen.");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setRecording(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60000);
    } catch (cause) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setRecording(false);
      setError(cause instanceof Error ? cause.message : "Mikrofonzugriff nicht möglich. Prüfe die Berechtigung deines Browsers.");
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
              {message.images && message.images.length > 0 && <div className="teacher-ai-attachments">
                {message.images.map((image, imageIndex) => <img className="teacher-ai-attachment-preview" key={imageIndex} src={image.preview} alt="Von dir hochgeladenes Foto" />)}
              </div>}
              <div className="teacher-ai-message-content">{renderChatContent(message.content)}</div>
              {message.role === "assistant" && <button type="button" className="teacher-ai-speak" onClick={() => speakMessage(message.content)}>🔊 Antwort vorlesen</button>}
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
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => void selectImages(event)} />
          <div className="teacher-ai-extra-tools">
            <button type="button" className="teacher-ai-tool-button" onClick={() => imageInputRef.current?.click()} disabled={busy || uploadingImages || recording}>
              {uploadingImages ? "Foto lädt …" : "＋ Foto"}
            </button>
            <button type="button" className={"teacher-ai-tool-button" + (recording ? " recording" : "")} onClick={() => void toggleRecording()} disabled={busy || transcribing || uploadingImages}>
              {recording ? "Aufnahme beenden" : transcribing ? "Sprache wird erkannt …" : "🎙 Sprechen"}
            </button>
            {recording && <span className="teacher-ai-recording-status">Aufnahme läuft · max. 60 Sekunden</span>}
          </div>
          {selectedImages.length > 0 && <div className="teacher-ai-upload-previews">
            {selectedImages.map((image, index) => <div className="teacher-ai-upload-preview" key={image.path}>
              <img src={image.preview} alt="Foto als Chat-Anhang" />
              <button type="button" aria-label="Foto entfernen" onClick={async () => {
                const { error: removeError } = await createClient().storage.from("ai-chat-uploads").remove([image.path]);
                if (removeError) setError("Das Foto konnte nicht entfernt werden.");
                setSelectedImages((current) => current.filter((item) => item.path !== image.path));
              }}>×</button>
            </div>)}
          </div>}
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
            <button className="teacher-ai-send" type="submit" aria-label="Nachricht senden" disabled={busy || actionBusy || uploadingImages || transcribing || recording || (!input.trim() && selectedImages.length === 0)}>{busy ? "…" : "↑"}</button>
          </div>
        </form>
        <p className="teacher-ai-footnote">{isStudent
          ? "Du kannst Fotos anhängen oder Fragen einsprechen. Die KI kann Fehler machen; prüfe wichtige Antworten und gib keine privaten Daten ein."
          : "Dateien kannst du herunterladen. Änderungen an Klassen und Stundenplänen werden nur nach deiner Bestätigung gespeichert. Gib keine vertraulichen Schüler- oder Personaldaten ein."}</p>
      </div>
    </div>
    
<style jsx global>{`
.teacher-ai-extra-tools { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 0 6px; }
.teacher-ai-tool-button { border: 1px solid var(--border); background: rgba(255,255,255,.035); color: var(--white); border-radius: 999px; padding: 7px 12px; font-size: .82rem; cursor: pointer; }
.teacher-ai-tool-button:disabled { opacity: .55; cursor: not-allowed; }
.teacher-ai-tool-button.recording { border-color: #e36b6b; color: #ffb6b6; background: rgba(220,70,70,.12); }
.teacher-ai-recording-status { color: #e7a2a2; font-size: .78rem; }
.teacher-ai-upload-previews, .teacher-ai-attachments { display: flex; flex-wrap: wrap; gap: 9px; margin: 8px 0; }
.teacher-ai-upload-preview { position: relative; width: 74px; height: 74px; }
.teacher-ai-upload-preview img, .teacher-ai-attachment-preview { width: 100%; height: 100%; max-width: 210px; max-height: 180px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border); }
.teacher-ai-upload-preview button { position: absolute; top: -7px; right: -7px; width: 23px; height: 23px; border-radius: 50%; border: 1px solid var(--border); background: #252235; color: white; cursor: pointer; }
.teacher-ai-speak { margin-top: 8px; background: transparent; border: 0; color: var(--muted); font-size: .8rem; cursor: pointer; padding: 3px 0; }
.teacher-ai-speak:hover { color: var(--white); }
@media (max-width: 640px) {
  .teacher-ai-extra-tools { gap: 6px; }
  .teacher-ai-tool-button { padding: 8px 10px; }
  .teacher-ai-attachment-preview { max-width: 160px; }
}
`}</style>
  </section>;
}
