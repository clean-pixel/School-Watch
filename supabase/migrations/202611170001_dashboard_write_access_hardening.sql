-- Dashboard write policies for messaging and class assignments.
-- All writes are restricted to an approved school administrator or an approved
-- staff member sending a message to a student in the same school.

-- Messages can only be created by approved school staff for their own school.
drop policy if exists messages_staff_insert on public.messages;
create policy messages_staff_insert
on public.messages
for insert
to authenticated
with check (
  school_id = (select public.current_school_id())
  and sender_id = (select auth.uid())
  and (select public.current_role()) in ('school_admin', 'teacher')
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = messages.school_id
      and p.registration_status = 'approved'
      and p.role in ('school_admin', 'teacher')
  )
);

-- A sender may add recipients only to their own message and only to approved
-- student accounts from the same school.
drop policy if exists message_recipients_sender_insert on public.message_recipients;
create policy message_recipients_sender_insert
on public.message_recipients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.messages m
    join public.profiles recipient on recipient.id = message_recipients.recipient_id
    where m.id = message_recipients.message_id
      and m.sender_id = (select auth.uid())
      and m.school_id = (select public.current_school_id())
      and recipient.school_id = m.school_id
      and recipient.role = 'student'
      and recipient.registration_status = 'approved'
  )
);

-- Only a school administrator can assign students to classes in their school.
drop policy if exists class_memberships_admin_insert on public.class_memberships;
create policy class_memberships_admin_insert
on public.class_memberships
for insert
to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
  and exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = (select auth.uid())
      and admin_profile.school_id = class_memberships.school_id
      and admin_profile.role = 'school_admin'
      and admin_profile.registration_status = 'approved'
  )
  and exists (
    select 1
    from public.classes c
    where c.id = class_memberships.class_id
      and c.school_id = class_memberships.school_id
  )
  and exists (
    select 1
    from public.students s
    where s.id = class_memberships.student_id
      and s.school_id = class_memberships.school_id
  )
);

drop policy if exists class_memberships_admin_delete on public.class_memberships;
create policy class_memberships_admin_delete
on public.class_memberships
for delete
to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
);

-- Only a school administrator can assign teachers to classes in their school.
drop policy if exists teacher_assignments_admin_insert on public.teacher_assignments;
create policy teacher_assignments_admin_insert
on public.teacher_assignments
for insert
to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
  and exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = (select auth.uid())
      and admin_profile.school_id = teacher_assignments.school_id
      and admin_profile.role = 'school_admin'
      and admin_profile.registration_status = 'approved'
  )
  and exists (
    select 1
    from public.classes c
    where c.id = teacher_assignments.class_id
      and c.school_id = teacher_assignments.school_id
  )
  and exists (
    select 1
    from public.teachers t
    where t.id = teacher_assignments.teacher_id
      and t.school_id = teacher_assignments.school_id
  )
);

drop policy if exists teacher_assignments_admin_delete on public.teacher_assignments;
create policy teacher_assignments_admin_delete
on public.teacher_assignments
for delete
to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
);

grant insert on public.messages, public.message_recipients to authenticated;
grant insert, delete on public.class_memberships, public.teacher_assignments to authenticated;

-- Trigger/event-trigger functions must never be callable through the public Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Helper functions are required by authenticated RLS policies, not anonymous clients.
revoke all on function public.current_role() from public, anon;
revoke all on function public.current_school_id() from public, anon;
revoke all on function public.is_school_staff(uuid) from public, anon;
revoke all on function public.is_class_member(uuid) from public, anon;
revoke all on function public.is_teacher_of_class(uuid) from public, anon;
grant execute on function public.current_role() to authenticated;
grant execute on function public.current_school_id() to authenticated;
grant execute on function public.is_school_staff(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;
grant execute on function public.is_teacher_of_class(uuid) to authenticated;

-- The public school picker is intentional; other workflow RPCs are signed-in only.
revoke all on function public.available_schools() from public;
grant execute on function public.available_schools() to anon, authenticated;

revoke all on function public.create_toilet_request() from public, anon;
grant execute on function public.create_toilet_request() to authenticated;
revoke all on function public.decide_toilet_request(uuid, public.toilet_request_state) from public, anon;
grant execute on function public.decide_toilet_request(uuid, public.toilet_request_state) to authenticated;
