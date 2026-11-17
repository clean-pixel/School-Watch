-- Allow an approved school administrator to edit only their own school's hours.
-- The rest of the school profile remains read-only to normal authenticated users.

alter table public.schools enable row level security;

drop policy if exists school_admin_update_own_hours on public.schools;
create policy school_admin_update_own_hours
on public.schools
for update
to authenticated
using (
  id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.schools.id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
)
with check (
  id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.schools.id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
);

-- Restrict school updates to the two fields the school-hours form is allowed to edit.
revoke update on table public.schools from authenticated;
grant update (day_start_time, day_end_time) on table public.schools to authenticated;

-- Neither table needs direct anonymous Data API access.
-- Public school discovery continues through the separately controlled available_schools() RPC.
revoke all on table public.schools from anon;
revoke all on table public.class_subjects from anon;

-- Keep the intended signed-in access for school/class subject features.
grant select, insert, update, delete on table public.class_subjects to authenticated;
