-- Allow a message sender to see the recipient rows for messages they sent,
-- while students can still see only messages addressed to themselves.
drop policy if exists recipients_read_own on public.message_recipients;
drop policy if exists recipients_read_own_or_sender on public.message_recipients;
create policy recipients_read_own_or_sender
on public.message_recipients
for select
to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1
    from public.messages m
    where m.id = message_recipients.message_id
      and m.sender_id = (select auth.uid())
  )
);