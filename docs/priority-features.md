# Priority implementation status

This update adds the first persisted version of a student exam planner, personal study notes/checklists, a private focus timer/history, a school calendar combining existing events/homework with exam and schedule-change entries, and a schedule-change notification fanout to class members. It also introduces per-student dashboard widget preference storage at the database layer.

Run `202611160008_student_planner_focus_calendar.sql` after migrations 001–007 in the intended Supabase project. Do not execute it against production without reviewing the SQL and testing against a backup/staging database. The migration is additive and does not delete existing data.

The focus history is private; exam notes and checklists are scoped to the logged-in student and their class. Calendar schedule changes are visible to the affected class and staff. The legacy `substitutions` table is untouched; the new `schedule_changes` table is the normalized app flow because the legacy table definition varies by prior migration state.

This update is not the entirety of the master prompt. PWA/offline caching, physical device enrollment/API, full student/teacher administration, live end-to-end testing against Supabase, and production privacy review remain open. No tests/build have been run in the hosted GitHub editing environment.
