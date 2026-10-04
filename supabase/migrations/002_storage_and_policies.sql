-- Run this after 001_initial_schema.sql in the Supabase SQL editor.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('item-images','item-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "item images publicly readable" on storage.objects for select using (bucket_id='item-images');
create policy "users upload own item images" on storage.objects for insert to authenticated with check (bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users update own item images" on storage.objects for update to authenticated using (bucket_id='item-images' and owner_id=auth.uid()::text) with check (bucket_id='item-images' and owner_id=auth.uid()::text);
create policy "users delete own item images" on storage.objects for delete to authenticated using (bucket_id='item-images' and owner_id=auth.uid()::text);
