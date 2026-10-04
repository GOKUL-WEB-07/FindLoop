-- Apply after 005. Private media for two-party conversations.
begin;
alter table public.messages add column if not exists attachment_path text;
alter table public.messages add column if not exists attachment_type text;
alter table public.messages drop constraint if exists messages_attachment_valid;
alter table public.messages add constraint messages_attachment_valid check (
  (attachment_path is null and attachment_type is null) or
  (attachment_path is not null and attachment_type is not null and attachment_type in ('photo','voice') and
   split_part(attachment_path,'/',1)=sender_id::text and
   split_part(attachment_path,'/',2)=recipient_id::text and
   split_part(attachment_path,'/',3)=listing_id::text)
);
-- Recipients may acknowledge messages, but cannot change sender/content/media.
revoke update on public.messages from authenticated, anon;
grant update(read_at) on public.messages to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('message-attachments','message-attachments',false,10485760,
 array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-m4a','audio/aac'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "message media upload" on storage.objects;
create policy "message media upload" on storage.objects for insert to authenticated
with check(bucket_id='message-attachments' and split_part(name,'/',1)=auth.uid()::text
 and exists(select 1 from public.profiles where id::text=split_part(name,'/',2))
 and exists(select 1 from public.lost_found_items where id::text=split_part(name,'/',3)));
drop policy if exists "message media participant read" on storage.objects;
create policy "message media participant read" on storage.objects for select to authenticated
using(bucket_id='message-attachments' and (
 split_part(name,'/',1)=auth.uid()::text or exists(
 select 1 from public.messages m where m.attachment_path=name and m.recipient_id=auth.uid()
 )));
drop policy if exists "message media owner cleanup" on storage.objects;
create policy "message media owner cleanup" on storage.objects for delete to authenticated
using(bucket_id='message-attachments' and split_part(name,'/',1)=auth.uid()::text);
notify pgrst, 'reload schema';
commit;
