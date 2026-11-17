create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 4 and 120),
  description text not null check (char_length(trim(description)) between 10 and 3000),
  page_path text check (page_path is null or char_length(page_path) <= 200),
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reward_points integer not null default 0 check (reward_points in (0, 25)),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bug_reports_review_state_check check (
    (status = 'pending' and reward_points = 0 and reviewed_by is null and reviewed_at is null)
    or
    (status = 'accepted' and reward_points = 25 and reviewed_by is not null and reviewed_at is not null)
    or
    (status = 'rejected' and reward_points = 0 and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists bug_reports_reporter_created_idx
  on public.bug_reports (reporter_id, created_at desc);
create index if not exists bug_reports_status_created_idx
  on public.bug_reports (status, created_at asc);

alter table public.bug_reports enable row level security;

drop policy if exists bug_reports_read_own_or_platform_admin on public.bug_reports;
create policy bug_reports_read_own_or_platform_admin
  on public.bug_reports
  for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'platform_admin'
    )
  );

drop policy if exists bug_reports_insert_own on public.bug_reports;
create policy bug_reports_insert_own
  on public.bug_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'pending'
    and reward_points = 0
    and reviewed_by is null
    and reviewed_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.registration_status = 'approved'
    )
  );

drop policy if exists bug_reports_update_platform_admin on public.bug_reports;
create policy bug_reports_update_platform_admin
  on public.bug_reports
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'platform_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'platform_admin'
    )
  );

grant select, insert, update on public.bug_reports to authenticated;
