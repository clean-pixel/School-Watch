-- Bug reports are only available to signed-in users.
-- RLS still controls which authenticated rows each user can access.
revoke all on table public.bug_reports from anon, public;
grant select, insert, update on table public.bug_reports to authenticated;
