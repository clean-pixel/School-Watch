-- Direct school and student registration, school-admin approval for teachers only.
-- This is a test-oriented open signup flow; use verified invitation codes in production.

create table if not exists public.teacher_join_requests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  state public.registration_state not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.teacher_join_requests enable row level security;
create policy teacher_join_requests_read_self_or_school_admin
  on public.teacher_join_requests for select
  using (teacher_id = auth.uid() or (school_id = public.current_school_id() and public.current_role() = 'school_admin'));
grant select on public.teacher_join_requests to authenticated;

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
  chosen_school_id uuid;
  new_school_id uuid;
  approval_status public.registration_state;
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
  approval_status := case when registration_type = 'teacher'
    then 'pending'::public.registration_state
    else 'approved'::public.registration_state end;

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
    values (left(trim(m->>'school_name'), 160), left(trim(m->>'school_type'), 100),
      left(trim(m->>'street'), 200), left(trim(m->>'postal_code'), 20),
      left(trim(m->>'city'), 120), left(trim(m->>'state'), 120), 'approved')
    returning id into new_school_id;
  else
    begin
      chosen_school_id := (m->>'school_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'choose an available school';
    end;
    if chosen_school_id is null or not exists (
      select 1 from public.schools where schools.id = chosen_school_id and schools.status = 'approved'
    ) then
      raise exception 'choose an available school';
    end if;
    new_school_id := chosen_school_id;
  end if;

  insert into public.profiles(id, school_id, role, display_name, registration_status)
  values (new.id, new_school_id, assigned_role,
    coalesce(contact_name, split_part(new.email, '@', 1)), approval_status);

  if registration_type = 'school' then
    -- School is created and available immediately; no school registration application.
    return new;
  elsif registration_type = 'teacher' then
    insert into public.teachers(id, school_id) values (new.id, new_school_id);
    insert into public.teacher_join_requests(teacher_id, school_id) values (new.id, new_school_id);
  else
    -- Students join the selected school immediately and do not need approval.
    insert into public.students(id, school_id) values (new.id, new_school_id);
  end if;
  return new;
end;
$$;

create or replace function public.review_teacher_join_request(p_request_id uuid, p_decision text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare request_row public.teacher_join_requests%rowtype;
begin
  if auth.uid() is null or public.current_role() is distinct from 'school_admin'::public.app_role then
    raise exception 'not authorized';
  end if;
  if p_decision not in ('approve', 'reject') then raise exception 'invalid decision'; end if;

  select * into request_row
  from public.teacher_join_requests
  where id = p_request_id
    and school_id = public.current_school_id()
    and state = 'pending'
  for update;
  if not found then raise exception 'request unavailable'; end if;

  update public.teacher_join_requests
  set state = case when p_decision = 'approve' then 'approved'::public.registration_state else 'rejected'::public.registration_state end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = request_row.id;
  update public.profiles
  set registration_status = case when p_decision = 'approve' then 'approved'::public.registration_state else 'rejected'::public.registration_state end
  where id = request_row.teacher_id and school_id = request_row.school_id and role = 'teacher';
end;
$$;
revoke all on function public.review_teacher_join_request(uuid, text) from public, anon;
grant execute on function public.review_teacher_join_request(uuid, text) to authenticated;
