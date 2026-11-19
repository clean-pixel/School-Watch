-- Private, temporary photo uploads for the SchoolWatch AI chat.
-- Files are scoped to the authenticated user's folder and deleted after AI processing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-chat-uploads',
  'ai-chat-uploads',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = 4194304,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists ai_chat_upload_own on storage.objects;
create policy ai_chat_upload_own
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'ai-chat-uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists ai_chat_read_own on storage.objects;
create policy ai_chat_read_own
on storage.objects
for select to authenticated
using (
  bucket_id = 'ai-chat-uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists ai_chat_delete_own on storage.objects;
create policy ai_chat_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id = 'ai-chat-uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
