-- Make class-subject access explicit:
-- approved school admins can manage subjects; approved teachers/students can read
-- only subjects for their own assigned classes.

drop policy if exists class_subjects_admin_manage on public.class_subjects;
drop policy if exists class_subjects_staff_manage on public.class_subjects;
drop policy if exists class_subjects_read_related on public.class_subjects;

create policy class_subjects_read_related
on public.class_subjects
for select
to authenticated
using (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.class_subjects.school_id
      and p.registration_status = 'approved'
      and (
        p.role = 'school_admin'
        or (p.role = 'teacher' and public.is_teacher_of_class(public.class_subjects.class_id))
        or (p.role = 'student' and public.is_class_member(public.class_subjects.class_id))
      )
  )
);

create policy class_subjects_admin_insert
on public.class_subjects
for insert
to authenticated
with check (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.class_subjects.school_id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
);

create policy class_subjects_admin_update
on public.class_subjects
for update
to authenticated
using (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.class_subjects.school_id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
)
with check (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.class_subjects.school_id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
);

create policy class_subjects_admin_delete
on public.class_subjects
for delete
to authenticated
using (
  school_id = (select public.current_school_id())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.school_id = public.class_subjects.school_id
      and p.role = 'school_admin'
      and p.registration_status = 'approved'
  )
);

revoke all on table public.class_subjects from anon;
grant select, insert, update, delete on table public.class_subjects to authenticated;
