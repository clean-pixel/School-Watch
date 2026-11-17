-- Atomic school messaging: validate sender and recipient and insert both rows
-- in one transaction while respecting RLS as the calling user.
create or replace function public.send_school_message(
  p_recipient_id uuid,
  p_subject text,
  p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  sender_school_id uuid;
  created_message_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if nullif(trim(coalesce(p_subject, '')), '') is null
     or char_length(trim(p_subject)) > 160
     or nullif(trim(coalesce(p_body, '')), '') is null
     or char_length(trim(p_body)) > 5000 then
    raise exception 'invalid message content';
  end if;

  select p.school_id into sender_school_id
  from public.profiles p
  where p.id = auth.uid()
    and p.registration_status = 'approved'
    and p.role in ('school_admin', 'teacher');

  if sender_school_id is null then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.profiles recipient
    where recipient.id = p_recipient_id
      and recipient.school_id = sender_school_id
      and recipient.role = 'student'
      and recipient.registration_status = 'approved'
  ) then
    raise exception 'recipient is not an approved student in this school';
  end if;

  insert into public.messages(school_id, sender_id, subject, body)
  values (sender_school_id, auth.uid(), trim(p_subject), trim(p_body))
  returning id into created_message_id;

  insert into public.message_recipients(message_id, recipient_id)
  values (created_message_id, p_recipient_id);

  return created_message_id;
end;
$$;

revoke all on function public.send_school_message(uuid, text, text) from public, anon;
grant execute on function public.send_school_message(uuid, text, text) to authenticated;