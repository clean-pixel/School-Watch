-- Safely repair incomplete teacher request rows without trusting mutable
-- auth.users.raw_user_meta_data to change existing user roles.
-- Does not promote student accounts. Existing accounts created before the
-- teacher-registration trigger must register again as a teacher after migration 005.

insert into public.teachers(id, school_id)
select p.id, p.school_id
from public.profiles p
where p.role = 'teacher'::public.app_role
  and p.registration_status = 'pending'
  and p.school_id is not null
  and exists (
    select 1 from public.schools s
    where s.id = p.school_id and s.status = 'approved'
  )
on conflict (id) do nothing;

insert into public.teacher_join_requests(teacher_id, school_id, state)
select p.id, p.school_id, 'pending'::public.registration_state
from public.profiles p
where p.role = 'teacher'::public.app_role
  and p.registration_status = 'pending'
  and p.school_id is not null
  and exists (
    select 1 from public.schools s
    where s.id = p.school_id and s.status = 'approved'
  )
on conflict (teacher_id) do nothing;

grant select on public.teacher_join_requests to authenticated;
