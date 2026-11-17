-- SchoolWatch learning workspace, class subjects, teacher worksheets and flexible school hours.
-- Existing timetable_entries.week_type and teacher_id, and teachers.subjects, are reused.

alter table public.schools
  add column if not exists day_start_time time not null default '07:45',
  add column if not exists day_end_time time not null default '17:00';

alter table public.schools
  drop constraint if exists schools_day_bounds_check;
alter table public.schools
  add constraint schools_day_bounds_check
  check (day_end_time > day_start_time);

alter table public.homework
  add column if not exists learning_scope text not null default '';

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  subject text not null check (char_length(subject) between 1 and 100),
  weekly_lessons smallint check (weekly_lessons is null or weekly_lessons between 1 and 20),
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id)
    references public.classes(id, school_id) on delete cascade,
  unique (class_id, subject)
);

create index if not exists class_subjects_school_class_idx
  on public.class_subjects(school_id, class_id, subject);

alter table public.class_subjects enable row level security;

drop policy if exists class_subjects_read_related on public.class_subjects;
create policy class_subjects_read_related
on public.class_subjects for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or public.is_teacher_of_class(class_id)
    or public.is_class_member(class_id)
  )
);

drop policy if exists class_subjects_staff_manage on public.class_subjects;
create policy class_subjects_staff_manage
on public.class_subjects for all to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or public.is_teacher_of_class(class_id)
  )
)
with check (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or public.is_teacher_of_class(class_id)
  )
);

grant select, insert, update, delete on public.class_subjects to authenticated;

create table if not exists public.lesson_worksheets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 100),
  title text not null check (char_length(title) between 1 and 160),
  topic text not null check (char_length(topic) between 1 and 500),
  content text not null check (char_length(content) between 1 and 20000),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (class_id, school_id)
    references public.classes(id, school_id) on delete cascade
);

create index if not exists lesson_worksheets_class_created_idx
  on public.lesson_worksheets(school_id, class_id, created_at desc);

alter table public.lesson_worksheets enable row level security;

drop policy if exists lesson_worksheets_read_related on public.lesson_worksheets;
create policy lesson_worksheets_read_related
on public.lesson_worksheets for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or (select public.current_role()) = 'teacher' and public.is_teacher_of_class(class_id)
    or (select public.current_role()) = 'student' and is_published and public.is_class_member(class_id)
  )
);

drop policy if exists lesson_worksheets_staff_insert on public.lesson_worksheets;
create policy lesson_worksheets_staff_insert
on public.lesson_worksheets for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and teacher_id = (select auth.uid())
  and (
    (select public.current_role()) = 'school_admin'
    or (select public.current_role()) = 'teacher' and public.is_teacher_of_class(class_id)
  )
);

drop policy if exists lesson_worksheets_staff_update on public.lesson_worksheets;
create policy lesson_worksheets_staff_update
on public.lesson_worksheets for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or teacher_id = (select auth.uid()) and public.is_teacher_of_class(class_id)
  )
)
with check (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or teacher_id = (select auth.uid()) and public.is_teacher_of_class(class_id)
  )
);

drop policy if exists lesson_worksheets_staff_delete on public.lesson_worksheets;
create policy lesson_worksheets_staff_delete
on public.lesson_worksheets for delete to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_role()) = 'school_admin'
    or teacher_id = (select auth.uid()) and public.is_teacher_of_class(class_id)
  )
);

grant select, insert, update, delete on public.lesson_worksheets to authenticated;
