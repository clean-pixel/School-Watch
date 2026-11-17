-- Test mode: school accounts are created as approved immediately.
-- Teacher/student accounts may self-select their role but are not attached to any school.
-- Do not apply this public self-service school approval flow to a production project.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  registration_type text := coalesce(m->>'registration_type', 'student');
  assigned_role public.app_role;
  new_school_id uuid;
  contact_name text := nullif(left(trim(coalesce(m->>'contact_name', '')), 120), '');
begin
  if registration_type not in ('school', 'teacher', 'student') then
    registration_type := 'student';
  end if;

  assigned_role := case registration_type
    when 'school' then 'school_admin'::public.app_role
    when 'teacher' then 'teacher'::public.app_role
    else 'student'::public.app_role
  end;

  if registration_type = 'school' then
    if nullif(trim(m->>'school_name'), '') is null
       or nullif(trim(m->>'school_type'), '') is null
       or nullif(trim(m->>'street'), '') is null
       or nullif(trim(m->>'postal_code'), '') is null
       or nullif(trim(m->>'city'), '') is null
       or nullif(trim(m->>'state'), '') is null then
      raise exception 'school registration details are required';
    end if;

    insert into public.schools(name, school_type, street, postal_code, city, state, status)
    values (
      left(trim(m->>'school_name'), 160), left(trim(m->>'school_type'), 100),
      left(trim(m->>'street'), 200), left(trim(m->>'postal_code'), 20),
      left(trim(m->>'city'), 120), left(trim(m->>'state'), 120), 'approved'
    ) returning id into new_school_id;
  end if;

  insert into public.profiles(id, school_id, role, display_name, registration_status)
  values (
    new.id, new_school_id, assigned_role,
    coalesce(contact_name, split_part(new.email, '@', 1)), 'approved'
  );

  if registration_type = 'school' then
    insert into public.school_registration_requests(
      applicant_id, school_id, school_name, school_type, street, postal_code,
      city, region, contact_name, email, state, reviewed_at
    ) values (
      new.id, new_school_id, left(trim(m->>'school_name'), 160),
      left(trim(m->>'school_type'), 100), left(trim(m->>'street'), 200),
      left(trim(m->>'postal_code'), 20), left(trim(m->>'city'), 120),
      left(trim(m->>'state'), 120), coalesce(contact_name, split_part(new.email, '@', 1)),
      new.email, 'approved', now()
    );
  end if;

  return new;
end;
$$;
