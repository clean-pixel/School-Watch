create extension if not exists pgcrypto;

create type public.app_role as enum ('platform_admin','school_admin','teacher','student');
create type public.registration_state as enum ('pending','approved','rejected','suspended');
create type public.toilet_request_state as enum ('pending','approved','denied','withdrawn');

create table public.schools (
 id uuid primary key default gen_random_uuid(), name text not null, school_type text not null,
 street text not null, postal_code text not null, city text not null, state text not null,
 status public.registration_state not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, school_id uuid references public.schools(id) on delete restrict,
 role public.app_role not null default 'student', display_name text, registration_status public.registration_state not null default 'approved',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.school_registration_requests (
 id uuid primary key default gen_random_uuid(), applicant_id uuid not null unique references auth.users(id) on delete cascade,
 school_id uuid references public.schools(id) on delete set null, school_name text not null, school_type text not null,
 street text not null, postal_code text not null, city text not null, region text not null, contact_name text not null,
 email text not null, state public.registration_state not null default 'pending', reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.classes (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 name text not null, grade text, created_at timestamptz not null default now(), unique(school_id,name), unique(id,school_id)
);
create table public.students (
 id uuid primary key references public.profiles(id) on delete cascade, school_id uuid not null references public.schools(id) on delete cascade,
 student_number text, created_at timestamptz not null default now(), unique(id,school_id)
);
create table public.teachers (
 id uuid primary key references public.profiles(id) on delete cascade, school_id uuid not null references public.schools(id) on delete cascade,
 created_at timestamptz not null default now(), unique(id,school_id)
);
create table public.class_memberships (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null, student_id uuid not null, created_at timestamptz not null default now(),
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(student_id,school_id) references public.students(id,school_id) on delete cascade, unique(class_id,student_id)
);
create table public.teacher_assignments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 class_id uuid not null, teacher_id uuid not null, subject text,
 foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,
 foreign key(teacher_id,school_id) references public.teachers(id,school_id) on delete cascade, unique(class_id,teacher_id,subject)
);
create table public.timetables (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,class_id uuid not null, name text not null default 'Stundenplan', created_at timestamptz not null default now(), foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade, unique(id,school_id));
create table public.timetable_entries (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,timetable_id uuid not null,weekday smallint not null check(weekday between 1 and 7), starts_at time not null, ends_at time not null check(ends_at>starts_at), subject text not null, room text, teacher_id uuid, foreign key(timetable_id,school_id) references public.timetables(id,school_id) on delete cascade, foreign key(teacher_id,school_id) references public.teachers(id,school_id) on delete set null);
create table public.substitutions (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,class_id uuid not null, substitute_teacher_id uuid, occurs_on date not null, subject text, room text, note text, created_at timestamptz not null default now(),foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,foreign key(substitute_teacher_id,school_id) references public.teachers(id,school_id) on delete set null);
create table public.homework (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,class_id uuid not null,teacher_id uuid not null,subject text not null,description text not null,due_at timestamptz not null,created_at timestamptz not null default now(),foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade,foreign key(teacher_id,school_id) references public.teachers(id,school_id) on delete cascade);
create table public.messages (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,sender_id uuid not null references public.profiles(id) on delete restrict,subject text not null,body text not null,created_at timestamptz not null default now());
create table public.message_recipients (message_id uuid not null references public.messages(id) on delete cascade,recipient_id uuid not null references public.profiles(id) on delete cascade,read_at timestamptz,primary key(message_id,recipient_id));
create table public.announcements (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,author_id uuid not null references public.profiles(id) on delete restrict,title text not null,body text not null,published_at timestamptz,created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(),school_id uuid references public.schools(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,title text not null,body text not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.toilet_requests (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,student_id uuid not null,teacher_id uuid not null,class_id uuid not null,status public.toilet_request_state not null default 'pending',created_at timestamptz not null default now(),decided_at timestamptz,foreign key(student_id,school_id) references public.students(id,school_id) on delete cascade,foreign key(teacher_id,school_id) references public.teachers(id,school_id) on delete cascade,foreign key(class_id,school_id) references public.classes(id,school_id) on delete cascade);
create unique index toilet_one_pending_per_student on public.toilet_requests(student_id) where status='pending';
create index toilet_teacher_pending_idx on public.toilet_requests(teacher_id,status,created_at);
create table public.school_events (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,class_id uuid references public.classes(id) on delete cascade,title text not null,description text,starts_at timestamptz not null,ends_at timestamptz,created_by uuid references public.profiles(id) on delete set null,created_at timestamptz not null default now());
create table public.devices (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,device_fingerprint text not null unique,status text not null default 'pending' check(status in ('pending','active','disabled')),last_seen_at timestamptz,created_at timestamptz not null default now());
create table public.device_assignments (id uuid primary key default gen_random_uuid(),school_id uuid not null references public.schools(id) on delete cascade,device_id uuid not null references public.devices(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,assigned_at timestamptz not null default now(),revoked_at timestamptz);
create unique index one_active_device_assignment on public.device_assignments(device_id) where revoked_at is null;
create table public.audit_logs (id uuid primary key default gen_random_uuid(),school_id uuid references public.schools(id) on delete set null,actor_id uuid references public.profiles(id) on delete set null,action text not null,entity_type text not null,entity_id uuid,metadata jsonb not null default '{}',created_at timestamptz not null default now());

create or replace function public.current_school_id() returns uuid language sql stable security definer set search_path=public as $$ select school_id from public.profiles where id=auth.uid() $$;
create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() $$;
create or replace function public.is_school_staff(target_school uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.school_id=target_school and p.registration_status='approved' and p.role in ('school_admin','teacher')) $$;
create or replace function public.is_class_member(target_class uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.class_memberships cm join public.profiles p on p.id=cm.student_id where cm.class_id=target_class and p.id=auth.uid()) $$;
create or replace function public.is_teacher_of_class(target_class uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.teacher_assignments ta where ta.class_id=target_class and ta.teacher_id=auth.uid()) $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public,auth as $$
declare m jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb); begin
 insert into public.profiles(id,role,display_name,registration_status)
 values(new.id,case when m->>'registration_type'='school' then 'school_admin'::public.app_role else 'student'::public.app_role end,coalesce(m->>'contact_name',split_part(new.email,'@',1)),case when m->>'registration_type'='school' then 'pending'::public.registration_state else 'approved'::public.registration_state end);
 if m->>'registration_type'='school' then
  insert into public.school_registration_requests(applicant_id,school_name,school_type,street,postal_code,city,region,contact_name,email)
  values(new.id,m->>'school_name',m->>'school_type',m->>'street',m->>'postal_code',m->>'city',m->>'state',m->>'contact_name',new.email);
 end if; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.create_toilet_request() returns uuid language plpgsql security invoker set search_path=public as $$
declare sid uuid; cid uuid; tid uuid; rid uuid; begin
 select school_id into sid from public.students where id=auth.uid();
 if sid is null then raise exception 'student profile required'; end if;
 select cm.class_id into cid from public.class_memberships cm where cm.student_id=auth.uid() order by cm.created_at desc limit 1;
 if cid is null then raise exception 'class assignment required'; end if;
 select ta.teacher_id into tid from public.teacher_assignments ta where ta.class_id=cid order by ta.id limit 1;
 if tid is null then raise exception 'responsible teacher unavailable'; end if;
 insert into public.toilet_requests(school_id,student_id,teacher_id,class_id) values(sid,auth.uid(),tid,cid) returning id into rid; return rid;
end $$;
create or replace function public.decide_toilet_request(p_request_id uuid,p_decision public.toilet_request_state) returns void language plpgsql security invoker set search_path=public as $$
declare r public.toilet_requests%rowtype; begin
 if p_decision not in ('approved','denied') then raise exception 'invalid decision'; end if;
 select * into r from public.toilet_requests where id=p_request_id for update;
 if not found or r.status<>'pending' or not (r.teacher_id=auth.uid() or (public.current_role()='school_admin' and r.school_id=public.current_school_id())) then raise exception 'not authorized'; end if;
 update public.toilet_requests set status=p_decision,decided_at=now() where id=p_request_id;
 insert into public.notifications(school_id,user_id,title,body) values(r.school_id,r.student_id,'Toilettenanfrage',case when p_decision='approved' then 'Deine Toilettenanfrage wurde genehmigt.' else 'Deine Toilettenanfrage wurde abgelehnt.' end);
end $$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_registration_requests enable row level security;
-- Enable RLS for every school-scoped table.
do $$ declare t text; begin foreach t in array array['classes','students','teachers','class_memberships','teacher_assignments','timetables','timetable_entries','substitutions','homework','messages','message_recipients','announcements','notifications','toilet_requests','school_events','devices','device_assignments','audit_logs'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy profile_read_self_or_school_staff on public.profiles for select using (id=auth.uid() or (school_id=public.current_school_id() and public.current_role() in ('school_admin','teacher')));
create policy profile_update_self on public.profiles for update using(id=auth.uid()) with check(id=auth.uid() and role=public.current_role() and school_id is not distinct from public.current_school_id());
create policy school_read_members on public.schools for select using(id=public.current_school_id() or public.current_role()='platform_admin');
create policy registration_read_own_or_admin on public.school_registration_requests for select using(applicant_id=auth.uid() or public.current_role()='platform_admin');
create policy classes_read_authorized on public.classes for select using(school_id=public.current_school_id() and (public.current_role() in ('school_admin','teacher') or public.is_class_member(id)));
create policy classes_admin_manage on public.classes for all using(school_id=public.current_school_id() and public.current_role()='school_admin') with check(school_id=public.current_school_id() and public.current_role()='school_admin');
create policy students_read_school_staff_or_self on public.students for select using(id=auth.uid() or (school_id=public.current_school_id() and public.current_role() in ('school_admin','teacher')));
create policy teachers_read_school on public.teachers for select using(school_id=public.current_school_id());
create policy memberships_read_related on public.class_memberships for select using(student_id=auth.uid() or school_id=public.current_school_id() and (public.current_role()='school_admin' or public.is_teacher_of_class(class_id)));
create policy assignments_read_related on public.teacher_assignments for select using(school_id=public.current_school_id());
create policy timetables_read_related on public.timetables for select using(school_id=public.current_school_id() and (public.current_role() in ('school_admin','teacher') or public.is_class_member(class_id)));
create policy timetable_entries_read_related on public.timetable_entries for select using(school_id=public.current_school_id());
create policy substitutions_read_school on public.substitutions for select using(school_id=public.current_school_id());
create policy homework_read_class on public.homework for select using(school_id=public.current_school_id() and (public.current_role() in ('school_admin','teacher') or public.is_class_member(class_id)));
create policy homework_teacher_manage on public.homework for all using(school_id=public.current_school_id() and (public.current_role()='school_admin' or teacher_id=auth.uid() and public.is_teacher_of_class(class_id))) with check(school_id=public.current_school_id() and (public.current_role()='school_admin' or teacher_id=auth.uid() and public.is_teacher_of_class(class_id)));
create policy messages_read_sender on public.messages for select using(sender_id=auth.uid() or exists(select 1 from public.message_recipients mr where mr.message_id=id and mr.recipient_id=auth.uid()));
create policy recipients_read_own on public.message_recipients for select using(recipient_id=auth.uid());
create policy announcements_read_published on public.announcements for select using(school_id=public.current_school_id() and published_at is not null);
create policy notifications_read_own on public.notifications for select using(user_id=auth.uid());
create policy notifications_update_own on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy toilet_read_participants on public.toilet_requests for select using(student_id=auth.uid() or teacher_id=auth.uid() or (school_id=public.current_school_id() and public.current_role()='school_admin'));
create policy toilet_student_insert on public.toilet_requests for insert with check(student_id=auth.uid() and school_id=public.current_school_id() and public.current_role()='student' and status='pending');
create policy events_read_school on public.school_events for select using(school_id=public.current_school_id() and (class_id is null or public.is_class_member(class_id) or public.current_role() in ('school_admin','teacher')));
create policy devices_read_admin on public.devices for select using(school_id=public.current_school_id() and public.current_role()='school_admin');
create policy device_assignments_read_owner_or_admin on public.device_assignments for select using(user_id=auth.uid() or school_id=public.current_school_id() and public.current_role()='school_admin');
create policy audit_read_admin on public.audit_logs for select using(public.current_role()='platform_admin' or school_id=public.current_school_id() and public.current_role()='school_admin');

grant usage on schema public to authenticated;
grant select on public.schools,public.profiles,public.school_registration_requests,public.classes,public.students,public.teachers,public.class_memberships,public.teacher_assignments,public.timetables,public.timetable_entries,public.substitutions,public.homework,public.messages,public.message_recipients,public.announcements,public.notifications,public.toilet_requests,public.school_events,public.devices,public.device_assignments,public.audit_logs to authenticated;
grant update on public.profiles,public.notifications to authenticated;
grant insert,update,delete on public.classes,public.homework to authenticated;
grant execute on function public.create_toilet_request() to authenticated;
grant execute on function public.decide_toilet_request(uuid,public.toilet_request_state) to authenticated;
