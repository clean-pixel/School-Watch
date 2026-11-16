create or replace function public.approve_school_registration(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  req public.school_registration_requests%rowtype;
  new_school_id uuid;
begin
  if auth.uid() is null or public.current_role() is distinct from 'platform_admin'::public.app_role then
    raise exception 'not authorized';
  end if;
  select * into req from public.school_registration_requests where id = p_request_id and state = 'pending' for update;
  if not found then raise exception 'registration request unavailable'; end if;
  insert into public.schools(name, school_type, street, postal_code, city, state, status)
  values(req.school_name, req.school_type, req.street, req.postal_code, req.city, req.state, 'approved')
  returning id into new_school_id;
  update public.profiles set school_id = new_school_id, role = 'school_admin', registration_status = 'approved'
    where id = req.applicant_id;
  update public.school_registration_requests set school_id = new_school_id, state = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = req.id;
  insert into public.audit_logs(school_id, actor_id, action, entity_type, entity_id)
  values(new_school_id, auth.uid(), 'school_registration_approved', 'school_registration_request', req.id);
  return new_school_id;
end;
$$;
revoke all on function public.approve_school_registration(uuid) from public, anon;
grant execute on function public.approve_school_registration(uuid) to authenticated;

-- Do not let users change their role, school or approval state through a profile update.
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_display_name on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Teachers only see classes to which they have an explicit assignment.
drop policy if exists classes_read_authorized on public.classes;
create policy classes_read_authorized on public.classes for select using (
  school_id = public.current_school_id() and (
    public.current_role() = 'school_admin' or
    (public.current_role() = 'teacher' and public.is_teacher_of_class(id)) or
    (public.current_role() = 'student' and public.is_class_member(id))
  )
);

-- CRUD policies used by the dashboard forms. Values are still constrained to the caller's school.
create policy announcement_staff_insert on public.announcements for insert with check (
  school_id = public.current_school_id() and author_id = auth.uid() and
  public.current_role() in ('school_admin','teacher') and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.registration_status = 'approved'
  )
);
create policy announcement_author_update on public.announcements for update using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or author_id = auth.uid())
) with check (school_id = public.current_school_id());
create policy announcement_author_delete on public.announcements for delete using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or author_id = auth.uid())
);
create policy events_staff_insert on public.school_events for insert with check (
  school_id = public.current_school_id() and created_by = auth.uid() and
  public.current_role() in ('school_admin','teacher') and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.registration_status = 'approved'
  ) and (class_id is null or public.current_role() = 'school_admin' or public.is_teacher_of_class(class_id))
);
create policy events_staff_update on public.school_events for update using (
  school_id = public.current_school_id() and public.current_role() in ('school_admin','teacher')
) with check (school_id = public.current_school_id());
create policy events_staff_delete on public.school_events for delete using (
  school_id = public.current_school_id() and public.current_role() in ('school_admin','teacher')
);
create policy timetable_staff_insert on public.timetables for insert with check (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or public.is_teacher_of_class(class_id))
);
create policy timetable_staff_manage on public.timetables for update using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or public.is_teacher_of_class(class_id))
) with check (school_id = public.current_school_id());
create policy timetable_entry_staff_insert on public.timetable_entries for insert with check (
  school_id = public.current_school_id() and exists (
    select 1 from public.timetables t where t.id = timetable_id and
    (public.current_role() = 'school_admin' or public.is_teacher_of_class(t.class_id))
  )
);
create policy timetable_entry_staff_update on public.timetable_entries for update using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or exists (
    select 1 from public.timetables t where t.id = timetable_id and public.is_teacher_of_class(t.class_id)
  ))
) with check (school_id = public.current_school_id());
create policy timetable_entry_staff_delete on public.timetable_entries for delete using (
  school_id = public.current_school_id() and (public.current_role() = 'school_admin' or exists (
    select 1 from public.timetables t where t.id = timetable_id and public.is_teacher_of_class(t.class_id)
  ))
);

grant insert, update, delete on public.announcements, public.school_events, public.timetables, public.timetable_entries to authenticated;
