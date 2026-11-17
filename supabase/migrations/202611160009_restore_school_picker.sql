-- Restore the public school-picker RPC for projects where the earlier migration
-- was skipped or partially applied. Supabase Auth still requires an email or phone;
-- no shared/fake email or privileged client is used here.
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
