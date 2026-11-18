-- Teacher-specific AI conversations and a digital classbook.
-- Every exposed table has RLS enabled and only approved teachers assigned to a class can use it.

create table if not exists public.teacher_ai_chats (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 1 and 100),
  title text not null check (char_length(trim(title)) between 1 and 160),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint teacher_ai_chats_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes(id, school_id) on delete cascade
);

create unique index if not exists teacher_ai_chats_one_default_per_subject
  on public.teacher_ai_chats(teacher_id, class_id, subject)
  where is_default = true;
create index if not exists teacher_ai_chats_teacher_updated
  on public.teacher_ai_chats(teacher_id, created_at desc);

create table if not exists public.teacher_ai_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.teacher_ai_chats(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index if not exists teacher_ai_messages_chat_created
  on public.teacher_ai_messages(chat_id, created_at);

create table if not exists public.classbook_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 1 and 100),
  lesson_date date not null default current_date,
  period smallint check (period between 1 and 12),
  lesson_topic text not null check (char_length(trim(lesson_topic)) between 1 and 200),
  lesson_content text not null default '' check (char_length(lesson_content) <= 12000),
  homework text not null default '' check (char_length(homework) <= 4000),
  teacher_notes text not null default '' check (char_length(teacher_notes) <= 4000),
  created_at timestamptz not null default now(),
  constraint classbook_entries_class_school_fkey
    foreign key (class_id, school_id)
    references public.classes(id, school_id) on delete cascade
);
create index if not exists classbook_entries_class_date
  on public.classbook_entries(class_id, lesson_date desc, created_at desc);
create index if not exists classbook_entries_teacher_date
  on public.classbook_entries(teacher_id, lesson_date desc);

create table if not exists public.classbook_attendance (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.classbook_entries(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'present'
    check (status in ('present', 'absent', 'late', 'excused')),
  created_at timestamptz not null default now(),
  unique (entry_id, student_id)
);
create index if not exists classbook_attendance_entry on public.classbook_attendance(entry_id);
create index if not exists classbook_attendance_student on public.classbook_attendance(student_id);

alter table public.teacher_ai_chats enable row level security;
alter table public.teacher_ai_messages enable row level security;
alter table public.classbook_entries enable row level security;
alter table public.classbook_attendance enable row level security;

drop policy if exists teacher_ai_chats_teacher_access on public.teacher_ai_chats;
create policy teacher_ai_chats_teacher_access
on public.teacher_ai_chats
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and school_id = (select public.current_school_id())
  and (select public.current_role()) = 'teacher'::public.app_role
  and public.is_school_staff(school_id)
  and public.is_teacher_of_class(class_id)
  and exists (
    select 1 from public.teacher_assignments ta
    where ta.school_id = teacher_ai_chats.school_id
      and ta.class_id = teacher_ai_chats.class_id
      and ta.teacher_id = teacher_ai_chats.teacher_id
      and ta.subject = teacher_ai_chats.subject
  )
)
with check (
  teacher_id = (select auth.uid())
  and school_id = (select public.current_school_id())
  and (select public.current_role()) = 'teacher'::public.app_role
  and public.is_school_staff(school_id)
  and public.is_teacher_of_class(class_id)
  and exists (
    select 1 from public.teacher_assignments ta
    where ta.school_id = teacher_ai_chats.school_id
      and ta.class_id = teacher_ai_chats.class_id
      and ta.teacher_id = teacher_ai_chats.teacher_id
      and ta.subject = teacher_ai_chats.subject
  )
);

drop policy if exists teacher_ai_messages_teacher_access on public.teacher_ai_messages;
create policy teacher_ai_messages_teacher_access
on public.teacher_ai_messages
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and school_id = (select public.current_school_id())
  and (select public.current_role()) = 'teacher'::public.app_role
  and exists (
    select 1 from public.teacher_ai_chats c
    where c.id = teacher_ai_messages.chat_id
      and c.teacher_id = teacher_ai_messages.teacher_id
      and c.school_id = teacher_ai_messages.school_id
  )
)
with check (
  teacher_id = (select auth.uid())
  and school_id = (select public.current_school_id())
  and (select public.current_role()) = 'teacher'::public.app_role
  and exists (
    select 1 from public.teacher_ai_chats c
    where c.id = teacher_ai_messages.chat_id
      and c.teacher_id = teacher_ai_messages.teacher_id
      and c.school_id = teacher_ai_messages.school_id
  )
);

drop policy if exists classbook_entries_teacher_access on public.classbook_entries;
create policy classbook_entries_teacher_access
on public.classbook_entries
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and school_id = (select public.current_school_id())
  and (select public.current_role()) = 'teacher'::public.app_role
  and public.is_school_staff(school_id)
  and public.is_teacher_of_class(class_id)
  and exists (
    select 1 from public.teacher_assignments ta
    where ta.school_id = classbook_entries.school_id
      and ta.class_id = classbook_entries.class_id
      and ta.teacher_id = classbook_entries.teacher_id
      and ta.subject = classbook_entries.subject
  )
)
with check (
  teacher_id = (select auth.uid())
  and school_id = (select public.current_school_id())
  and (select public.current_role()) = 'teacher'::public.app_role
  and public.is_school_staff(school_id)
  and public.is_teacher_of_class(class_id)
  and exists (
    select 1 from public.teacher_assignments ta
    where ta.school_id = classbook_entries.school_id
      and ta.class_id = classbook_entries.class_id
      and ta.teacher_id = classbook_entries.teacher_id
      and ta.subject = classbook_entries.subject
  )
);

drop policy if exists classbook_attendance_teacher_access on public.classbook_attendance;
create policy classbook_attendance_teacher_access
on public.classbook_attendance
for all to authenticated
using (
  school_id = (select public.current_school_id())
  and exists (
    select 1 from public.classbook_entries ce
    where ce.id = classbook_attendance.entry_id
      and ce.school_id = classbook_attendance.school_id
      and ce.teacher_id = (select auth.uid())
      and public.is_teacher_of_class(ce.class_id)
  )
)
with check (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.classbook_entries ce
    join public.class_memberships cm
      on cm.school_id = ce.school_id
     and cm.class_id = ce.class_id
     and cm.student_id = classbook_attendance.student_id
    where ce.id = classbook_attendance.entry_id
      and ce.school_id = classbook_attendance.school_id
      and ce.teacher_id = (select auth.uid())
      and public.is_teacher_of_class(ce.class_id)
  )
);

revoke all on public.teacher_ai_chats, public.teacher_ai_messages, public.classbook_entries, public.classbook_attendance from anon;
grant select, insert, update, delete on public.teacher_ai_chats, public.teacher_ai_messages, public.classbook_entries, public.classbook_attendance to authenticated;
