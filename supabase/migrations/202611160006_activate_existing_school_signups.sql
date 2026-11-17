-- Repair school signups created by the older application-based registration trigger.
-- Those accounts already have a school_registration_requests row, but previously the
-- school and its school_id were only created after a manual platform-admin approval.
-- This test-mode migration makes each existing school signup active and keeps its
-- original account as that school's school administrator.
do $$
declare
  request_row public.school_registration_requests%rowtype;
  created_school_id uuid;
begin
  for request_row in
    select * from public.school_registration_requests
    where school_id is null and state in ('pending', 'approved')
    order by created_at
  loop
    insert into public.schools(name, school_type, street, postal_code, city, state, status)
    values (request_row.school_name, request_row.school_type, request_row.street,
      request_row.postal_code, request_row.city, request_row.region, 'approved')
    returning id into created_school_id;

    update public.school_registration_requests
    set school_id = created_school_id,
        state = 'approved',
        reviewed_at = coalesce(reviewed_at, now())
    where id = request_row.id;

    update public.profiles
    set school_id = created_school_id,
        role = 'school_admin',
        registration_status = 'approved'
    where id = request_row.applicant_id;
  end loop;
end;
$$;

-- Keep school discovery available to the registration page while respecting RLS.
create or replace function public.available_schools()
returns table(id uuid, name text, city text)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.city
  from public.schools s
  where s.status = 'approved'
  order by s.name, s.city;
$$;
revoke all on function public.available_schools() from public;
grant execute on function public.available_schools() to anon, authenticated;
