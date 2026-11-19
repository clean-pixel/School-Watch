-- LernLoop: personal flashcards with spaced repetition.
-- Cards belong to one student; RLS prevents cross-account access.

create table if not exists public.student_flashcards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 1 and 80),
  question text not null check (char_length(trim(question)) between 1 and 1200),
  answer text not null check (char_length(trim(answer)) between 1 and 2400),
  due_at timestamptz not null default now(),
  interval_days integer not null default 0 check (interval_days between 0 and 365),
  repetitions integer not null default 0 check (repetitions >= 0),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_flashcards_due_idx
  on public.student_flashcards (student_id, due_at asc);

alter table public.student_flashcards enable row level security;

drop policy if exists student_flashcards_read_own on public.student_flashcards;
create policy student_flashcards_read_own
  on public.student_flashcards
  for select to authenticated
  using ((select auth.uid()) = student_id);

drop policy if exists student_flashcards_insert_own on public.student_flashcards;
create policy student_flashcards_insert_own
  on public.student_flashcards
  for insert to authenticated
  with check (
    (select auth.uid()) = student_id
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'::public.app_role
        and p.registration_status = 'approved'::public.registration_state
    )
  );

drop policy if exists student_flashcards_update_own on public.student_flashcards;
create policy student_flashcards_update_own
  on public.student_flashcards
  for update to authenticated
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id);

drop policy if exists student_flashcards_delete_own on public.student_flashcards;
create policy student_flashcards_delete_own
  on public.student_flashcards
  for delete to authenticated
  using ((select auth.uid()) = student_id);

grant select, insert, update, delete on public.student_flashcards to authenticated;
