-- Timetable entries must follow the visibility of their parent timetable.
-- Students see entries only for their own classes; teachers only for assigned
-- classes; school administrators can see all entries in their school.
drop policy if exists timetable_entries_read_related on public.timetable_entries;
create policy timetable_entries_read_related
on public.timetable_entries
for select
to authenticated
using (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.timetables t
    where t.id = timetable_entries.timetable_id
      and t.school_id = timetable_entries.school_id
      and (
        (select public.current_role()) = 'school_admin'
        or (
          (select public.current_role()) = 'teacher'
          and public.is_teacher_of_class(t.class_id)
        )
        or (
          (select public.current_role()) = 'student'
          and public.is_class_member(t.class_id)
        )
      )
  )
);

-- A suspended or otherwise unapproved school administrator must not retain
-- direct API access to remove class or teacher assignments.
drop policy if exists class_memberships_admin_delete on public.class_memberships;
create policy class_memberships_admin_delete
on public.class_memberships
for delete
to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_role()) = 'school_admin'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = class_memberships.school_id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
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
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = teacher_assignments.school_id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
);