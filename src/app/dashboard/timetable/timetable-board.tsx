"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { moveTimetableEntry } from "@/app/dashboard/actions";

export type TimetableEntryView = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  subject: string;
  room: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  week_type: "both" | "A" | "B";
};

const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

export function TimetableBoard({
  entries,
  schoolStart,
  schoolEnd,
  canEdit,
}: {
  entries: TimetableEntryView[];
  schoolStart: string;
  schoolEnd: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [week, setWeek] = useState<"A" | "B" | "all">("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const visibleEntries = useMemo(
    () => entries.filter((entry) => week === "all" || entry.week_type === "both" || entry.week_type === week),
    [entries, week]
  );

  async function move(entryId: string, weekday: number) {
    const form = new FormData();
    form.set("entryId", entryId);
    form.set("weekday", String(weekday));
    const result = await moveTimetableEntry(form);
    setMessage(result.success ? "Stunde verschoben." : result.message || "Verschieben fehlgeschlagen.");
    if (result.success) router.refresh();
  }

  return (
    <section className="card timetable-panel">
      <div className="row timetable-toolbar">
        <div>
          <h2>Wochenplan</h2>
          <p>Schulzeit: {schoolStart.slice(0, 5)} bis {schoolEnd.slice(0, 5)} Uhr. Ziehe Unterrichtskästen auf einen anderen Wochentag.</p>
        </div>
        <div className="week-switch" aria-label="Wochenansicht">
          <button type="button" className={week === "all" ? "button" : "button secondary"} onClick={() => setWeek("all")}>Alle</button>
          <button type="button" className={week === "A" ? "button" : "button secondary"} onClick={() => setWeek("A")}>A-Woche</button>
          <button type="button" className={week === "B" ? "button" : "button secondary"} onClick={() => setWeek("B")}>B-Woche</button>
        </div>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
      <div className="timetable-board">
        {days.map((day, index) => {
          const weekday = index + 1;
          const dayEntries = visibleEntries
            .filter((entry) => entry.weekday === weekday)
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
          return (
            <div
              className="timetable-day"
              key={day}
              onDragOver={(event) => { if (canEdit) event.preventDefault(); }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || draggingId;
                if (canEdit && id) void move(id, weekday);
                setDraggingId(null);
              }}
            >
              <div className="timetable-day-heading">
                <strong>{day}</strong>
                <span>{dayEntries.length} {dayEntries.length === 1 ? "Stunde" : "Stunden"}</span>
              </div>
              <div className="timetable-dropzone">
                {dayEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className={`timetable-entry ${draggingId === entry.id ? "is-dragging" : ""}`}
                    draggable={canEdit}
                    onDragStart={(event) => {
                      setDraggingId(entry.id);
                      event.dataTransfer.setData("text/plain", entry.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="timetable-entry-head">
                      <strong>{entry.subject}</strong>
                      <span className={`week-pill week-${entry.week_type.toLowerCase()}`}>
                        {entry.week_type === "both" ? "A + B" : `Woche ${entry.week_type}`}
                      </span>
                    </div>
                    <div className="timetable-time">{entry.starts_at.slice(0, 5)}–{entry.ends_at.slice(0, 5)}</div>
                    <div className="timetable-meta">{entry.teacher_name || "Lehrkraft offen"}{entry.room ? ` · Raum ${entry.room}` : ""}</div>
                    {canEdit && <label className="timetable-move-select">
                      <span className="sr-only">Stunde verschieben</span>
                      <select
                        aria-label={`${entry.subject} verschieben`}
                        value={String(entry.weekday)}
                        onChange={(event) => void move(entry.id, Number(event.target.value))}
                      >
                        {days.map((option, optionIndex) => <option key={option} value={optionIndex + 1}>{option}</option>)}
                      </select>
                    </label>}
                  </article>
                ))}
                {dayEntries.length === 0 && <div className="timetable-empty">{canEdit ? "Stunde hier ablegen" : "Keine Stunde"}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="timetable-hint">A-Wochen- und B-Wochen-Stunden werden getrennt angezeigt. Stunden mit „A + B“ finden jede Woche statt.</p>
    </section>
  );
}
