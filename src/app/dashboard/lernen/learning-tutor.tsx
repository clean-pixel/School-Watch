"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type GeneratedFile = { name: string; format: "md" | "txt" | "csv" | "html" | "json"; content: string };
type ProposedAction =
  | { type: "create_class"; name: string; grade?: string | null; subjects: string[] }
  | { type: "add_subjects"; className: string; subjects: string[] }
  | { type: "assign_teacher"; className: string; subject: string; teacherId: string }
  | { type: "create_timetable"; className: string; entries: Array<{ weekday: number; startsAt: string; endsAt: string; subject: string; room?: string | null; weekType: "both" | "A" | "B" }> }
  | { type: "update_school_hours"; dayStart: string; dayEnd: string };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  files?: GeneratedFile[];
  actions?: ProposedAction[];
  actionResult?: string;
  actionsApplied?: boolean;
};
type ChatSession = { id: string; title: string; messages: ChatMessage[] };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};

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
  if (action.type === "update_school_hours") return "Schulzeiten: " + action.dayStart + "–" + action.dayEnd + " Uhr";
  return "Schuländerung";
}

export function LearningTutor({
  userRole,
  initialPrompt,
  initialTitle = "Schule einrichten",
  onboardingMode = false,
}: {
  userRole: string;
  initialPrompt?: string;
  initialTitle?: string;
  onboardingMode?: boolean;
}) {
  const [chats, setChats] = useState<ChatSession[]>([{ id: "start", title: "Neuer Chat", messages: [] }]);
  const [activeChatId, setActiveChatId] = useState("start");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const [listening, setListening] = useState(false);
  const [speakingMessage, setSpeakingMessage] = useState<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const initializationStarted = useRef(false);
  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) ?? chats[0], [chats, activeChatId]);
  const isStudent = userRole === "student";
  const canApplyActions = userRole === "teacher" || userRole === "school_admin";

  useEffect(() => {
    if (!initialPrompt || initializationStarted.current) return;
    initializationStarted.current = true;

    const chatId = "school-onboarding";
    const firstMessage: ChatMessage = { role: "user", content: initialPrompt };
    setChats([{ id: chatId, title: initialTitle, messages: [firstMessage] }]);
    setActiveChatId(chatId);
    setError("");
    setBusy(true);

    void (async () => {
      try {
        const response = await fetch("/api/learning/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(onboardingMode ? { mode: "school_onboarding" } : {}),
            messages: [{ role: "user", content: initialPrompt }],
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Die KI-Einrichtung konnte nicht gestartet werden.");
        setChats((current) => current.map((chat) => chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, {
                role: "assistant",
                content: String(payload.answer ?? "Ich konnte die erste Einrichtungsfrage nicht erstellen."),
                files: Array.isArray(payload.files) ? payload.files : [],
                actions: Array.isArray(payload.actions) ? payload.actions : [],
              }],
            }
          : chat));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Die KI-Einrichtung konnte nicht gestartet werden.");
      } finally {
        setBusy(false);
      }
    })();
  }, [initialPrompt, initialTitle, onboardingMode]);

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
    if ((!content && attachments.length === 0) || busy || !activeChat) return;
    const chatId = activeChat.id;
    const images = attachments.map((item) => item.dataUrl);
    const messageContent = content || "Bitte analysiere das hochgeladene Bild und erkläre mir, was darauf zu sehen ist.";
    const conversation: ChatMessage[] = [...activeChat.messages, { role: "user", content: messageContent, ...(images.length ? { images } : {}) }];
    setChats((current) => current.map((chat) => chat.id === chatId
      ? { ...chat, title: chat.messages.length === 0 ? titleFromMessage(content) : chat.title, messages: conversation }
      : chat));
    setInput("");
    setAttachments([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/learning/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(onboardingMode ? { mode: "school_onboarding" } : {}),
          messages: (() => { const recent = conversation.slice(-12); const latestImageIndex = recent.reduce((last, message, index) => message.images?.length ? index : last, -1); return recent.map((message, index) => ({ role: message.role, content: message.content, ...(index === latestImageIndex && message.images?.length ? { images: message.images } : {}) })); })(),
        }),
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
      setAttachments(images.map((dataUrl, index) => ({ name: "Bild " + (index + 1), dataUrl })));
      setError(err instanceof Error ? err.message : "Verbindung zur SchulWatch KI fehlgeschlagen.");
    } finally {
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const selected = Array.from(files).slice(0, 2 - attachments.length);
    if (!selected.length) { setError("Du kannst pro Nachricht höchstens zwei Bilder anhängen."); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const next = [...attachments];
    for (const file of selected) {
      if (!allowed.includes(file.type)) { setError("Bitte lade nur JPG-, PNG- oder WEBP-Bilder hoch."); continue; }
      if (file.size > 12 * 1024 * 1024) { setError("Das Originalbild darf höchstens 12 MB groß sein."); continue; }
      const dataUrl = await createImageBitmap(file).then(async (bitmap) => {
        const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Bild konnte nicht verarbeitet werden.");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Bild konnte nicht komprimiert werden.")), "image/jpeg", 0.72);
        });
        if (blob.size > 1500000) throw new Error("Das Bild ist nach der Komprimierung noch zu groß. Bitte wähle ein kleineres Bild.");
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Bild konnte nicht gelesen werden."));
          reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
          reader.readAsDataURL(blob);
        });
      }).catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Bild konnte nicht verarbeitet werden.");
        return "";
      });
      if (dataUrl) next.push({ name: file.name, dataUrl });
    }
    setAttachments(next);
  }

  function startVoiceInput() {
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setError("Spracheingabe wird von diesem Browser nicht unterstützt. Nutze bitte Chrome oder Edge."); return; }
    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim();
      if (transcript) setInput((current) => current ? current + " " + transcript : transcript);
    };
    recognition.onerror = () => { setError("Die Spracheingabe hat nicht funktioniert. Prüfe die Mikrofonberechtigung."); setListening(false); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function speakAnswer(content: string, index: number) {
    if (!("speechSynthesis" in window)) { setError("Sprachausgabe wird von diesem Browser nicht unterstützt."); return; }
    if (speakingMessage === index) { window.speechSynthesis.cancel(); setSpeakingMessage(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content.replace(/[*#`]/g, " "));
    utterance.lang = "de-DE";
    utterance.onend = () => setSpeakingMessage(null);
    utterance.onerror = () => setSpeakingMessage(null);
    setSpeakingMessage(index);
    window.speechSynthesis.speak(utterance);
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
      const actionSummary = String(payload.summary || "Änderungen verarbeitet.");
      setChats((current) => current.map((chat) => chat.id === chatId
        ? { ...chat, messages: chat.messages.map((message, index) => index === messageIndex
            ? { ...message, actionResult: actionSummary, actionsApplied: true }
            : message) }
        : chat));

      if (onboardingMode && payload.success) {
        const currentChat = chats.find((chat) => chat.id === chatId);
        if (currentChat) {
          const continueInstruction = "Die vorgeschlagenen Änderungen wurden soeben erfolgreich gespeichert. Prüfe den aktualisierten Schulkontext und führe die Einrichtung mit dem nächsten noch offenen Schritt fort. Stelle wieder nur eine konkrete Frage.";
          const history = [
            ...currentChat.messages.slice(-11).map((message) => ({ role: message.role, content: message.content })),
            { role: "user" as const, content: continueInstruction },
          ];
          const nextResponse = await fetch("/api/learning/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "school_onboarding", messages: history }),
          });
          const nextPayload = await nextResponse.json();
          if (!nextResponse.ok) throw new Error(nextPayload.error || "Die Änderungen sind gespeichert, aber die nächste Einrichtungsfrage konnte nicht geladen werden.");
          setChats((current) => current.map((chat) => chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, {
                  role: "assistant",
                  content: String(nextPayload.answer ?? "Die Einrichtung kann fortgesetzt werden. Was möchtest du als Nächstes einrichten?"),
                  files: Array.isArray(nextPayload.files) ? nextPayload.files : [],
                  actions: Array.isArray(nextPayload.actions) ? nextPayload.actions : [],
                }],
              }
            : chat));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Die Änderungen konnten nicht gespeichert werden.");
    } finally {
      setActionBusy(false);
    }
  }

  return <section className="teacher-ai-shell" aria-label="Chat mit SchulWatch KI">
    <style jsx global>{`
      .teacher-ai-image-attachments,.teacher-ai-pending-images{display:flex;flex-wrap:wrap;gap:9px;margin-top:10px}
      .teacher-ai-image-attachments img,.teacher-ai-pending-image img{width:150px;height:112px;object-fit:cover;border-radius:12px;border:1px solid var(--border)}
      .teacher-ai-pending-image{position:relative}
      .teacher-ai-pending-image button{position:absolute;right:5px;top:5px;border:0;border-radius:50%;width:25px;height:25px;background:#111;color:white;cursor:pointer}
      .teacher-ai-extra-tools{display:flex;gap:7px;flex-wrap:wrap}
      .teacher-ai-tool,.teacher-ai-speak{border:1px solid var(--border);background:transparent;color:var(--white);border-radius:10px;padding:8px 11px;cursor:pointer;font:inherit;font-size:.85rem}
      .teacher-ai-tool.active{border-color:var(--purple);color:var(--purple)}
      .teacher-ai-tool:disabled{opacity:.5;cursor:not-allowed}
      .teacher-ai-speak{margin-top:9px}
      .teacher-ai-next-step a{color:var(--purple);font-weight:700;text-decoration:none}
      @media(max-width:600px){.teacher-ai-enter-hint{display:none}.teacher-ai-composer-tools{gap:8px;flex-wrap:wrap}}
    `}</style>
    <aside className="teacher-ai-sidebar">
      <div className="teacher-ai-brand">
        <span className="teacher-ai-brand-mark">S</span>
        <span><strong>SchulWatch KI</strong><small>{onboardingMode ? "Deine Schule wird eingerichtet" : isStudent ? "Dein Lern-Assistent" : "Dein Schul-Assistent"}</small></span>
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
          <span className="teacher-ai-context-label">{onboardingMode ? "GEFÜHRTER SCHULSTART" : isStudent ? "LERN-ASSISTENT" : "SCHUL-ASSISTENT"}</span>
          <strong>{activeChat?.title ?? "Neuer Chat"}</strong>
          <span>{onboardingMode ? "Die KI fragt nach und richtet bestätigte Angaben ein." : "Freier Chat · Dateien, Planung und Schulaufgaben"}</span>
        </div>
        <span className="teacher-ai-ready"><i /> Bereit</span>
      </header>

      <div className="teacher-ai-messages" aria-live="polite">
        {!activeChat?.messages.length ? (
          <div className="teacher-ai-welcome">
            <div className="teacher-ai-welcome-mark">S</div>
            <div className="teacher-ai-welcome-eyebrow">SCHULWATCH KI</div>
            <h2>{onboardingMode ? "Wir richten deine Schule gemeinsam ein." : isStudent ? "Was möchtest du heute wissen?" : "Wobei kann ich dich unterstützen?"}</h2>
            <p>{onboardingMode
              ? "Die KI stellt dir Schritt für Schritt Fragen. Sie schlägt Klassen, Fächer und Schulzeiten vor und richtet bestätigte Angaben direkt ein."
              : isStudent
                ? "Frag einfach drauflos. Ich kann dir Themen erklären, bei Hausaufgaben helfen und Lernmaterialien als Datei erstellen."
                : "Stelle Fragen, erstelle Dateien, entwirf Stundenpläne und bereite Klassen- und Fachstrukturen vor. Änderungen werden erst nach deiner Bestätigung gespeichert."}</p>
            {!onboardingMode && <div className="teacher-ai-prompts">
              {suggestions.map((suggestion) => <button type="button" key={suggestion.label}
                onClick={() => { setInput(suggestion.text); composerRef.current?.focus(); }}>
                <span>{suggestion.label}</span><span aria-hidden="true">↗</span>
              </button>)}
            </div>}
          </div>
        ) : activeChat.messages.map((message, index) => (
          <article className={"teacher-ai-message " + message.role} key={index}>
            {message.role === "assistant" && <span className="teacher-ai-message-avatar" aria-hidden="true">S</span>}
            <div className="teacher-ai-message-body">
              {message.role === "user" && <small>Du</small>}
              <div className="teacher-ai-message-content">{renderChatContent(message.content)}</div>
              {message.images && message.images.length > 0 && <div className="teacher-ai-image-attachments">
                {message.images.map((image, imageIndex) => <a href={image} target="_blank" rel="noreferrer" key={imageIndex}>
                  <img src={image} alt={"Hochgeladenes Bild " + (imageIndex + 1)} />
                </a>)}
              </div>}
              {message.role === "assistant" && <button type="button" className="teacher-ai-speak" onClick={() => speakAnswer(message.content, index)}>
                {speakingMessage === index ? "■ Vorlesen stoppen" : "🔊 Antwort vorlesen"}
              </button>}
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
              {message.actionResult && userRole === "school_admin" && !onboardingMode && message.actions?.some((action) => action.type === "create_class") && <p className="teacher-ai-next-step">
                <a href="/dashboard/schule-setup">Weiter mit Fächern, Lehrkräften und Schulstundenplan →</a>
              </p>}
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
        {attachments.length > 0 && <div className="teacher-ai-pending-images">
          {attachments.map((image, index) => <div className="teacher-ai-pending-image" key={index}>
            <img src={image.dataUrl} alt={image.name} />
            <button type="button" aria-label="Bild entfernen" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>
          </div>)}
        </div>}
        <form className="teacher-ai-composer" onSubmit={send}>
          <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
            onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} />
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
            <div className="teacher-ai-extra-tools">
              <button type="button" className="teacher-ai-tool" onClick={() => imageInputRef.current?.click()} disabled={busy || actionBusy || attachments.length >= 2}>＋ Bild</button>
              <button type="button" className={"teacher-ai-tool" + (listening ? " active" : "")}
                onClick={() => listening ? recognitionRef.current?.stop() : startVoiceInput()} disabled={busy || actionBusy}>
                {listening ? "■ Aufnahme stoppen" : "🎙 Sprechen"}
              </button>
            </div>
            <span className="teacher-ai-enter-hint">Enter zum Senden · Shift + Enter für neue Zeile</span>
            <button className="teacher-ai-send" type="submit" aria-label="Nachricht senden" disabled={busy || actionBusy || (!input.trim() && attachments.length === 0)}>{busy ? "…" : "↑"}</button>
          </div>
        </form>
        <p className="teacher-ai-footnote">{isStudent
          ? "Die KI kann Fehler machen. Prüfe wichtige Antworten und gib keine privaten Daten ein. Chats werden nicht dauerhaft gespeichert."
          : onboardingMode
          ? "Die KI speichert keine Änderung ohne deine Bestätigung. Lehrkräfte und Schüler werden nicht erfunden; noch fehlende Konten müssen sich zuerst registrieren."
          : "Dateien kannst du herunterladen. Änderungen an Klassen und Stundenplänen werden nur nach deiner Bestätigung gespeichert. Gib keine vertraulichen Schüler- oder Personaldaten ein."}</p>
      </div>
    </div>
  </section>;
}
