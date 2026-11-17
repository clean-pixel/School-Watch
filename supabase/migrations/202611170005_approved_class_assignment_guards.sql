-- Only active, approved students and teachers can be assigned to classes.
-- This prevents accounts awaiting approval or already rejected from being linked
-- to class resources even if a stale membership row exists.

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
    join public.profiles student_profile
      on student_profile.id = s.id
     and student_profile.school_id = s.school_id
     and student_profile.role = 'student'
     and student_profile.registration_status = 'approved'
    where s.id = class_memberships.student_id
      and s.school_id = class_memberships.school_id
  )
);

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
    join public.profiles teacher_profile
      on teacher_profile.id = t.id
     and teacher_profile.school_id = t.school_id
     and teacher_profile.role = 'teacher'
     and teacher_profile.registration_status = 'approved'
    where t.id = teacher_assignments.teacher_id
      and t.school_id = teacher_assignments.school_id
  )
);