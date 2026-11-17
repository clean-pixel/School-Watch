-- Repair teacher signup requests that were registered before the teacher request
-- table/trigger migration was applied. No school or student applications are created.
-- Safe to apply once after migrations 001-006; existing rows are not deleted.

-- Older versions treated every non-school account as a student. Restore the chosen
-- teacher role and school from Supabase Auth metadata for those earlier signups.
update public.profiles p
set role = 'teacher'::public.app_role,
    school_id = (u.raw_user_meta_data->>'school_id')::uuid,
    registration_status = 'pending'
from auth.users u
join public.schools s
  on s.id = (u.raw_user_meta_data->>'school_id')::uuid
 and s.status = 'approved'
where p.id = u.id
  and p.role = 'student'::public.app_role
  and u.raw_user_meta_data->>'registration_type' = 'teacher'
  and coalesce(u.raw_user_meta_data->>'school_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Ensure each pending teacher profile has both a staff record and a visible
-- school-admin approval request, including accounts created while migrations were
-- only partially applied.
insert into public.teachers(id, school_id)
select p.id, p.school_id
from public.profiles p
where p.role = 'teacher'::public.app_role
  and p.registration_status = 'pending'
  and p.school_id is not null
on conflict (id) do nothing;

insert into public.teacher_join_requests(teacher_id, school_id, state)
select p.id, p.school_id, 'pending'::public.registration_state
from public.profiles p
where p.role = 'teacher'::public.app_role
  and p.registration_status = 'pending'
  and p.school_id is not null
  and exists (select 1 from public.schools s where s.id = p.school_id and s.status = 'approved')
on conflict (teacher_id) do nothing;

-- Verify table access remains limited by the table's RLS policy; this grant does
-- not bypass RLS. School admins can see requests only for their own school.
grant select on public.teacher_join_requests to authenticated;
