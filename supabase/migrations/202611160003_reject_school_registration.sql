-- Only a platform administrator may reject an open school registration.
create or replace function public.reject_school_registration(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  req public.school_registration_requests%rowtype;
begin
  if auth.uid() is null or public.current_role() is distinct from 'platform_admin'::public.app_role then
    raise exception 'not authorized';
  end if;

  select * into req
  from public.school_registration_requests
  where id = p_request_id and state = 'pending'
  for update;
  if not found then raise exception 'registration request unavailable'; end if;

  update public.profiles
  set registration_status = 'rejected'
  where id = req.applicant_id;

  update public.school_registration_requests
  set state = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
  where id = req.id;

  insert into public.audit_logs(school_id, actor_id, action, entity_type, entity_id)
  values(null, auth.uid(), 'school_registration_rejected', 'school_registration_request', req.id);
end;
$$;

revoke all on function public.reject_school_registration(uuid) from public, anon;
grant execute on function public.reject_school_registration(uuid) to authenticated;
