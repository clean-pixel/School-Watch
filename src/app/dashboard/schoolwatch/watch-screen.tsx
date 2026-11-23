"use client";

import { useState } from "react";

type TimetableItem = {
  id: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
};

type HomeworkItem = {
  id: string;
  subject: string;
  description: string;
  dueAt: string;
};

type MessageItem = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
};

type ChangeItem = {
  id: string;
  subject: string | null;
  room: string | null;
  note: string | null;
  occursOn: string;
};

type Props = {
  mode: "live" | "demo";
  studentName: string;
  dateLabel: string;
  timeLabel: string;
  timetable: TimetableItem[];
  homework: HomeworkItem[];
  messages: MessageItem[];
  changes: ChangeItem[];
};

const navItems = [
  { id: "home", icon: "◷", label: "Start" },
  { id: "plan", icon: "▦", label: "Plan" },
  { id: "homework", icon: "✓", label: "Aufgaben" },
  { id: "messages", icon: "✉", label: "Post" },
  { id: "changes", icon: "↻", label: "Änderung" },
] as const;

function shortTime(value: string) {
  return value ? value.slice(0, 5) : "";
}

function shortDate(value: string) {
  if (!value) return "Ohne Datum";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

export default function WatchScreen(props: Props) {
  const [active, setActive] = useState<(typeof navItems)[number]["id"]>("home");
  const [done, setDone] = useState<string[]>([]);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

  const nextLesson = props.timetable.find((item) => shortTime(item.endsAt) > props.timeLabel);
  const panelStyle = {
    background: "#FFFFFF",
    color: "#161616",
    borderRadius: 24,
    padding: 18,
    minHeight: 485,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  };
  const smallLabel = { fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: "#545454" };
  const itemCard = {
    border: "2px solid #E3E3E3",
    borderRadius: 16,
    padding: 13,
    background: "#FFFFFF",
  };

  return (
    <section style={{ maxWidth: 470, margin: "24px auto 0" }}>
      <div style={{ background: "#111111", borderRadius: 44, padding: 14, boxShadow: "0 18px 48px rgba(0,0,0,.18)" }}>
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...smallLabel, color: "#333333" }}>SCHOOLWATCH OS</span>
            <span aria-label="Batterie" style={{ fontSize: 13, fontWeight: 800 }}>● 92 %</span>
          </div>

          {active === "home" && (
            <>
              <div>
                <div style={{ fontSize: 13, color: "#555555", fontWeight: 700 }}>{props.dateLabel}</div>
                <div style={{ fontSize: 58, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-.06em", marginTop: 5 }}>{props.timeLabel}</div>
                <div style={{ fontSize: 15, color: "#555555", marginTop: 5 }}>Hallo, {props.studentName}</div>
              </div>
              <div style={{ background: "#F0F0F0", borderRadius: 19, padding: 16 }}>
                <div style={smallLabel}>NÄCHSTE UNTERRICHTSSTUNDE</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, marginTop: 7 }}>
                  {nextLesson?.subject ?? "Keine weitere Stunde"}
                </div>
                {nextLesson ? (
                  <div style={{ fontSize: 16, marginTop: 8, lineHeight: 1.5 }}>
                    {shortTime(nextLesson.startsAt)}–{shortTime(nextLesson.endsAt)} Uhr
                    <br />
                    Raum {nextLesson.room || "Noch offen"}
                  </div>
                ) : (
                  <div style={{ fontSize: 15, marginTop: 8 }}>Dein Stundenplan ist aktuell leer oder der Unterricht ist vorbei.</div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { id: "plan", icon: "▦", label: "Stundenplan" },
                  { id: "homework", icon: "✓", label: "Aufgaben" },
                  { id: "messages", icon: "✉", label: "Nachrichten" },
                  { id: "changes", icon: "↻", label: "Änderungen" },
                ].map((item) => (
                  <button key={item.id} type="button" onClick={() => setActive(item.id as typeof active)}
                    style={{ minHeight: 76, borderRadius: 15, border: "2px solid #D7D7D7", background: "#FFFFFF", color: "#111111", fontSize: 15, fontWeight: 800, cursor: "pointer", padding: 9 }}>
                    <span style={{ display: "block", fontSize: 26, lineHeight: 1.2 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {active === "plan" && (
            <>
              <div>
                <div style={smallLabel}>HEUTE</div>
                <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, marginTop: 5 }}>Stundenplan</div>
              </div>
              {props.timetable.length === 0 ? <p style={{ fontSize: 17 }}>Für heute sind keine Stunden eingetragen.</p> :
                props.timetable.map((item) => (
                  <article key={item.id} style={itemCard}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#555555" }}>{shortTime(item.startsAt)}–{shortTime(item.endsAt)}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, marginTop: 5 }}>{item.subject}</div>
                    <div style={{ fontSize: 16, marginTop: 4 }}>Raum {item.room || "Noch offen"}</div>
                  </article>
                ))}
            </>
          )}

          {active === "homework" && (
            <>
              <div>
                <div style={smallLabel}>DEINE AUFGABEN</div>
                <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, marginTop: 5 }}>Hausaufgaben</div>
              </div>
              {props.homework.length === 0 ? <p style={{ fontSize: 17 }}>Aktuell sind keine Hausaufgaben eingetragen.</p> :
                props.homework.map((item) => {
                  const isDone = done.includes(item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => setDone((current) => isDone ? current.filter((id) => id !== item.id) : [...current, item.id])}
                      aria-pressed={isDone}
                      style={{ ...itemCard, textAlign: "left" as const, cursor: "pointer", opacity: isDone ? .62 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, border: "2px solid #222222", borderRadius: 10, fontSize: 22, fontWeight: 900 }}>{isDone ? "✓" : ""}</span>
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ display: "block", fontSize: 19 }}>{item.subject}</strong>
                          <span style={{ display: "block", fontSize: 15, marginTop: 4, lineHeight: 1.35 }}>{item.description}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 10, color: "#555555" }}>Fällig: {shortDate(item.dueAt)}</div>
                    </button>
                  );
                })}
              <p style={{ fontSize: 12, color: "#555555" }}>Abhaken wird in dieser Vorschau nur lokal gespeichert.</p>
            </>
          )}

          {active === "messages" && (
            <>
              <div>
                <div style={smallLabel}>MITTEILUNGEN</div>
                <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, marginTop: 5 }}>Nachrichten</div>
              </div>
              {props.messages.length === 0 ? <p style={{ fontSize: 17 }}>Du hast aktuell keine Nachrichten.</p> :
                props.messages.map((item) => (
                  <button key={item.id} type="button" onClick={() => setExpandedMessage((current) => current === item.id ? null : item.id)}
                    aria-expanded={expandedMessage === item.id}
                    style={{ ...itemCard, textAlign: "left" as const, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <strong style={{ fontSize: 18 }}>{item.subject}</strong>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>{item.read ? "Gelesen" : "Neu"}</span>
                    </div>
                    {expandedMessage === item.id && <p style={{ fontSize: 15, lineHeight: 1.45, marginBottom: 0 }}>{item.body}</p>}
                    <div style={{ fontSize: 12, color: "#555555", marginTop: 8 }}>{item.createdAt ? shortDate(item.createdAt) : ""}</div>
                  </button>
                ))}
            </>
          )}

          {active === "changes" && (
            <>
              <div>
                <div style={smallLabel}>ÄNDERUNGEN FÜR HEUTE</div>
                <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, marginTop: 5 }}>Vertretungen</div>
              </div>
              {props.changes.length === 0 ? <p style={{ fontSize: 17 }}>Für heute sind keine Vertretungen eingetragen.</p> :
                props.changes.map((item) => (
                  <article key={item.id} style={itemCard}>
                    <div style={{ fontSize: 21, fontWeight: 800 }}>{item.subject || "Unterrichtsänderung"}</div>
                    {item.room && <div style={{ fontSize: 16, marginTop: 7 }}>Raum {item.room}</div>}
                    {item.note && <p style={{ fontSize: 15, lineHeight: 1.4, marginBottom: 0 }}>{item.note}</p>}
                  </article>
                ))}
            </>
          )}

          <div style={{ marginTop: "auto", borderTop: "2px solid #E6E6E6", paddingTop: 10, display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 4 }}>
            {navItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setActive(item.id)}
                aria-current={active === item.id ? "page" : undefined}
                style={{ border: active === item.id ? "2px solid #111111" : "2px solid transparent", borderRadius: 12, background: active === item.id ? "#EFEFEF" : "transparent", color: "#111111", minHeight: 54, cursor: "pointer", padding: "4px 2px", fontWeight: 800 }}>
                <span style={{ display: "block", fontSize: 20, lineHeight: 1.1 }}>{item.icon}</span>
                <span style={{ display: "block", fontSize: 10, lineHeight: 1.1, marginTop: 3 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
        {props.mode === "live" ? "Live-Daten des angemeldeten Schülerkontos" : "Demo-Modus · Beispieldaten"}
      </div>
    </section>
  );
}
