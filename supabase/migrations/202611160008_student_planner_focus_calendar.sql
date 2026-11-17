-- Priority student features: exams/study planning, dashboard preferences, focus history,
-- calendar schedule changes, and notification fanout. Existing tables are not deleted.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  subject text not null check (char_length(subject) between 1 and 100),
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade
);
create index if not exists exams_school_class_start_idx on public.exams(school_id, class_id, starts_at);
alter table public.exams enable row level security;
create policy exams_read_related on public.exams for select using (
  school_id = public.current_school_id() and
  (public.current_role() in ('school_admin','teacher') or public.is_class_member(class_id))
);
create policy exams_staff_insert on public.exams for insert with check (
  school_id = public.current_school_id() and created_by = auth.uid() and
  public.current_role() in ('school_admin','teacher') and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.registration_status = 'approved') and
  (public.current_role() = 'school_admin' or public.is_teacher_of_class(class_id))
);
create policy exams_staff_update on public.exams for update using (
  school_id = public.current_school_id() and
  (public.current_role() = 'school_admin' or (created_by = auth.uid() and public.is_teacher_of_class(class_id)))
) with check (school_id = public.current_school_id());
create policy exams_staff_delete on public.exams for delete using (
  school_id = public.current_school_id() and
  (public.current_role() = 'school_admin' or (created_by = auth.uid() and public.is_teacher_of_class(class_id)))
);
grant select, insert, update, delete on public.exams to authenticated;

create table if not exists public.exam_study_notes (
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (exam_id, student_id)
);
alter table public.exam_study_notes enable row level security;
create policy exam_notes_own on public.exam_study_notes for all using (
  student_id = auth.uid() and exists (select 1 from public.exams e where e.id = exam_id and public.is_class_member(e.class_id))
) with check (
  student_id = auth.uid() and exists (select 1 from public.exams e where e.id = exam_id and public.is_class_member(e.class_id))
);
grant select, insert, update, delete on public.exam_study_notes to authenticated;

create table if not exists public.exam_checklist_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.exam_checklist_items enable row level security;
create policy exam_checklist_own on public.exam_checklist_items for all using (
  student_id = auth.uid() and exists (select 1 from public.exams e where e.id = exam_id and public.is_class_member(e.class_id))
) with check (
  student_id = auth.uid() and exists (select 1 from public.exams e where e.id = exam_id and public.is_class_member(e.class_id))
);
grant select, insert, update, delete on public.exam_checklist_items to authenticated;

create table if not exists public.student_dashboard_preferences (
  student_id uuid primary key references public.students(id) on delete cascade,
  widgets text[] not null default array['timetable','homework','exams','messages','calendar'],
  updated_at timestamptz not null default now(),
  constraint valid_student_widgets check (widgets <@ array['timetable','homework','exams','messages','calendar','announcements']::text[])
);
alter table public.student_dashboard_preferences enable row level security;
create policy student_dashboard_preferences_own on public.student_dashboard_preferences for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
grant select, insert, update on public.student_dashboard_preferences to authenticated;

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  focus_minutes smallint not null check (focus_minutes between 5 and 180),
  break_minutes smallint not null check (break_minutes between 1 and 60),
  completed_at timestamptz not null default now()
);
create index if not exists focus_sessions_student_completed_idx on public.focus_sessions(student_id, completed_at desc);
alter table public.focus_sessions enable row level security;
create policy focus_sessions_own on public.focus_sessions for all using (student_id = auth.uid()) with check (student_id = auth.uid());
grant select, insert on public.focus_sessions to authenticated;

-- A normalized event table avoids depending on legacy substitutions column names.
create table if not exists public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  changed_by uuid not null references public.profiles(id) on delete restrict,
  change_type text not null check (change_type in ('cancelled','room','teacher','rescheduled')),
  title text not null check (char_length(title) between 1 and 160),
  details text not null default '' check (char_length(details) <= 2000),
  applies_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id) references public.classes(id, school_id) on delete cascade
);
create index if not exists schedule_changes_class_applies_idx on public.schedule_changes(school_id, class_id, applies_at);
alter table public.schedule_changes enable row level security;
create policy schedule_changes_read_related on public.schedule_changes for select using (
  school_id = public.current_school_id() and
  (public.current_role() in ('school_admin','teacher') or public.is_class_member(class_id))
);
create policy schedule_changes_staff_insert on public.schedule_changes for insert with check (
  school_id = public.current_school_id() and changed_by = auth.uid() and
  public.current_role() in ('school_admin','teacher') and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.registration_status = 'approved') and
  (public.current_role() = 'school_admin' or public.is_teacher_of_class(class_id))
);
create policy schedule_changes_staff_update on public.schedule_changes for update using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or changed_by = auth.uid())
) with check (school_id = public.current_school_id());
create policy schedule_changes_staff_delete on public.schedule_changes for delete using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or changed_by = auth.uid())
);
grant select, insert, update, delete on public.schedule_changes to authenticated;

create or replace function public.notify_schedule_change()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.notifications(school_id, user_id, title, body)
  select new.school_id, cm.student_id, 'Stundenplanänderung: ' || new.title,
         coalesce(nullif(new.details, ''), 'Bitte prüfe deinen aktuellen Stundenplan.')
  from public.class_memberships cm
  where cm.school_id = new.school_id and cm.class_id = new.class_id
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.notify_schedule_change() from public, anon, authenticated;
drop trigger if exists schedule_change_notify_students on public.schedule_changes;
create trigger schedule_change_notify_students after insert on public.schedule_changes
  for each row execute function public.notify_schedule_change();
