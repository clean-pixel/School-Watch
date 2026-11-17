import { describe, expect, it } from "vitest";
import { z } from "zod";

const widgetSchema = z.array(z.enum(["timetable", "homework", "exams", "messages", "calendar", "announcements"])).max(6);
const focusSchema = z.object({ focusMinutes: z.coerce.number().int().min(5).max(180), breakMinutes: z.coerce.number().int().min(1).max(60) });
const examSchema = z.object({ classId: z.string().uuid(), subject: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(160) });

describe("Student planner validation", () => {
  it("accepts supported dashboard widgets and rejects unknown widgets", () => {
    expect(widgetSchema.safeParse(["timetable", "exams", "calendar"]).success).toBe(true);
    expect(widgetSchema.safeParse(["messages", "private-data"]).success).toBe(false);
  });
  it("bounds focus and break durations", () => {
    expect(focusSchema.safeParse({ focusMinutes: "25", breakMinutes: "5" }).success).toBe(true);
    expect(focusSchema.safeParse({ focusMinutes: "1", breakMinutes: "0" }).success).toBe(false);
  });
  it("validates exam class and content", () => {
    expect(examSchema.safeParse({ classId: "00000000-0000-4000-8000-000000000001", subject: "Mathe", title: "Klassenarbeit" }).success).toBe(true);
    expect(examSchema.safeParse({ classId: "bad", subject: "", title: "" }).success).toBe(false);
  });
});
