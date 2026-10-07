-- Repair backend contracts and authorization without removing user data.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.owns_lending_item(p_item_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.lending_items i where i.id=p_item_id and i.owner_id=auth.uid());
$$;
create or replace function private.is_lending_item_participant(p_item_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.borrow_requests r where r.item_id=p_item_id and r.borrower_id=auth.uid()) or exists(select 1 from public.borrow_transactions t where t.item_id=p_item_id and (t.borrower_id=auth.uid() or t.lender_id=auth.uid())));
$$;
revoke all on function private.owns_lending_item(uuid),private.is_lending_item_participant(uuid) from public,anon;
grant execute on function private.owns_lending_item(uuid),private.is_lending_item_participant(uuid) to authenticated;
-- Replace overlapping policies with explicit actions and ownership checks.
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists "own lf modify" on public.lost_found_items;
drop policy if exists "own lf insert" on public.lost_found_items;
drop policy if exists "active lf readable" on public.lost_found_items;
create policy "active lf public readable" on public.lost_found_items for select to anon using(status in ('active','potential_match'));
create policy "active lf readable" on public.lost_found_items for select to authenticated using(status in ('active','potential_match') or owner_id=(select auth.uid()) or exists(select 1 from public.messages m where m.listing_id=lost_found_items.id and (m.sender_id=(select auth.uid()) or m.recipient_id=(select auth.uid()))));
create policy "own lf insert" on public.lost_found_items for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "own lf update" on public.lost_found_items for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "own lf delete" on public.lost_found_items for delete to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "own lend modify" on public.lending_items;
drop policy if exists "own lend insert" on public.lending_items;
drop policy if exists "lend readable" on public.lending_items;
drop policy if exists "lend participant readable" on public.lending_items;
create policy "lend participant readable" on public.lending_items for select to authenticated using(status='available' or owner_id=(select auth.uid()) or private.is_lending_item_participant(id));
create policy "own lend insert" on public.lending_items for insert to authenticated with check(owner_id=(select auth.uid()) and status='available');
create policy "own lend update" on public.lending_items for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "own lend delete" on public.lending_items for delete to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "request parties can read" on public.borrow_requests;
drop policy if exists "request party read" on public.borrow_requests;
drop policy if exists "request borrower insert" on public.borrow_requests;
create policy "request parties can read" on public.borrow_requests for select to authenticated using(borrower_id=(select auth.uid()) or private.owns_lending_item(item_id));
create policy "request borrower insert" on public.borrow_requests for insert to authenticated with check(borrower_id=(select auth.uid()) and status='pending');
drop policy if exists "transaction parties read" on public.borrow_transactions;
create policy "transaction parties read" on public.borrow_transactions for select to authenticated using(borrower_id=(select auth.uid()) or lender_id=(select auth.uid()));
drop policy if exists "notification owner" on public.notifications;
create policy "notification owner read" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy "notification owner update" on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
drop policy if exists "block owner" on public.blocked_users;
create policy "block owner" on public.blocked_users for all to authenticated using(blocker_id=(select auth.uid())) with check(blocker_id=(select auth.uid()));
drop policy if exists "message parties can read" on public.messages;
drop policy if exists "sender can send" on public.messages;
drop policy if exists "recipient marks messages read" on public.messages;
create policy "message parties can read" on public.messages for select to authenticated using(sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy "sender can send" on public.messages for insert to authenticated with check(sender_id=(select auth.uid()));
create policy "recipient marks messages read" on public.messages for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));
-- Column privileges protect roles, identities, message contents and generated notifications.
revoke all on public.profiles,public.lost_found_items,public.lending_items,public.borrow_requests,public.borrow_transactions,public.notifications,public.messages,public.blocked_users from anon,authenticated;
grant select on public.profiles,public.lost_found_items to anon,authenticated;
grant select on public.lending_items,public.borrow_requests,public.borrow_transactions,public.notifications,public.messages,public.blocked_users to authenticated;
grant update(full_name,avatar_url,department,academic_year,bio,updated_at) on public.profiles to authenticated;
grant insert(owner_id,listing_type,item_name,category,description,location,event_date,image_urls,status),update(item_name,category,description,location,event_date,image_urls,status,updated_at),delete on public.lost_found_items to authenticated;
grant insert(owner_id,title,category,description,pickup_location,condition,max_borrow_days,image_urls,status,library_name,available_from),update(title,category,description,pickup_location,condition,max_borrow_days,image_urls,status,library_name,available_from,archived_at,updated_at),delete on public.lending_items to authenticated;
grant insert(item_id,borrower_id,start_date,return_date,message,student_name,student_email,student_id_card_url) on public.borrow_requests to authenticated;
grant update(read) on public.notifications to authenticated;
grant insert(listing_id,sender_id,recipient_id,body,attachment_path,attachment_type),update(read_at) on public.messages to authenticated;
grant insert,delete on public.blocked_users to authenticated;
-- A borrower may request the same item again after a rejection or completed loan.
alter table public.borrow_requests drop constraint if exists borrow_requests_item_id_borrower_id_status_key;
create unique index if not exists borrow_requests_one_pending_idx on public.borrow_requests(item_id,borrower_id) where status='pending';
create unique index if not exists transactions_one_open_item_idx on public.borrow_transactions(item_id) where status in ('scheduled','active','return_requested');
create index if not exists lending_owner_idx on public.lending_items(owner_id,created_at desc);
create index if not exists lf_owner_idx on public.lost_found_items(owner_id,created_at desc);
create index if not exists transactions_item_idx on public.borrow_transactions(item_id);
create index if not exists messages_sender_idx on public.messages(sender_id,created_at desc);
create index if not exists blocked_users_blocked_idx on public.blocked_users(blocked_id);
create index if not exists borrow_requests_borrower_idx on public.borrow_requests(borrower_id,created_at desc);
create index if not exists borrow_requests_item_idx on public.borrow_requests(item_id);
-- Validation runs inside the database as well as in the client.
create or replace function private.validate_borrow_request() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.lending_items;
begin
 if auth.uid() is null or new.borrower_id is distinct from auth.uid() then raise exception 'Please sign in to request an item.'; end if;
 select * into i from public.lending_items where id=new.item_id for update;
 if not found or i.status<>'available' then raise exception 'This item is not available.'; end if;
 if i.owner_id=new.borrower_id then raise exception 'You cannot borrow your own item.'; end if;
 if new.status<>'pending' then raise exception 'New requests must be pending.'; end if;
 if new.start_date<current_date or new.start_date<i.available_from then raise exception 'Choose a start date on or after the item is available.'; end if;
 if new.return_date<=new.start_date or new.return_date-new.start_date>i.max_borrow_days then raise exception 'The borrowing period exceeds the allowed duration.'; end if;
 if nullif(btrim(new.student_name),'') is null or nullif(btrim(new.student_email),'') is null then raise exception 'Student name and email are required.'; end if;
 if new.student_id_card_url is not null and split_part(new.student_id_card_url,'/',1)<>new.borrower_id::text then raise exception 'Upload your own student ID card.'; end if;
 if exists(select 1 from public.blocked_users b where (b.blocker_id=i.owner_id and b.blocked_id=new.borrower_id) or (b.blocker_id=new.borrower_id and b.blocked_id=i.owner_id)) then raise exception 'This exchange is not permitted.'; end if;
 return new;
end; $$;
drop trigger if exists validate_borrow_request on public.borrow_requests;
create trigger validate_borrow_request before insert on public.borrow_requests for each row execute function private.validate_borrow_request();
create or replace function private.validate_message() returns trigger language plpgsql security definer set search_path='' as $$
declare listing_owner uuid;
begin
 if auth.uid() is null or new.sender_id is distinct from auth.uid() then raise exception 'Please sign in to send a message.'; end if;
 select owner_id into listing_owner from public.lost_found_items where id=new.listing_id;
 if listing_owner is null or (listing_owner<>new.sender_id and listing_owner<>new.recipient_id) then raise exception 'Messages must include the listing owner.'; end if;
 if exists(select 1 from public.blocked_users b where (b.blocker_id=new.sender_id and b.blocked_id=new.recipient_id) or (b.blocker_id=new.recipient_id and b.blocked_id=new.sender_id)) then raise exception 'This conversation is not permitted.'; end if;
 return new;
end; $$;
drop trigger if exists validate_message on public.messages;
create trigger validate_message before insert on public.messages for each row execute function private.validate_message();
create or replace function private.protect_lending_state() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='DELETE' or (tg_op='UPDATE' and new.status is distinct from old.status) then
   if exists(select 1 from public.borrow_transactions t where t.item_id=old.id and t.status in ('scheduled','active','return_requested')) then raise exception 'Complete the active loan before removing this listing.'; end if;
   if tg_op='UPDATE' and new.status<>'archived' then raise exception 'Loan status must be changed through the lending workflow.'; end if;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
drop trigger if exists protect_lending_state on public.lending_items;
create trigger protect_lending_state before update or delete on public.lending_items for each row execute function private.protect_lending_state();
-- Missing avatar storage and private student verification media.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,3145728,array['image/jpeg','image/png','image/webp']),('student-id-cards','student-id-cards',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Explicitly approved: protect legacy ID uploads; updated clients use signed image links.
update storage.buckets set public=false where id='item-images';
drop policy if exists "item images publicly readable" on storage.objects;
create policy "item images authorized read" on storage.objects for select to authenticated using(bucket_id='item-images' and (name not like '%/id-cards/%' or split_part(name,'/',1)=(select auth.uid())::text or exists(select 1 from public.borrow_requests r where r.student_id_card_url like '%/item-images/'||objects.name and private.owns_lending_item(r.item_id))));
create policy "avatars readable" on storage.objects for select to anon,authenticated using(bucket_id='avatars');
create policy "avatars own upload" on storage.objects for insert to authenticated with check(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy "avatars own delete" on storage.objects for delete to authenticated using(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy "student ID own upload" on storage.objects for insert to authenticated with check(bucket_id='student-id-cards' and split_part(name,'/',1)=(select auth.uid())::text);
create policy "student ID authorized read" on storage.objects for select to authenticated using(bucket_id='student-id-cards' and (split_part(name,'/',1)=(select auth.uid())::text or exists(select 1 from public.borrow_requests r where r.student_id_card_url=objects.name and private.owns_lending_item(r.item_id))));
create policy "student ID own delete" on storage.objects for delete to authenticated using(bucket_id='student-id-cards' and split_part(name,'/',1)=(select auth.uid())::text and not exists(select 1 from public.borrow_requests r where r.student_id_card_url=objects.name));
-- Internal helpers stay outside the Data API; workflow RPCs require login.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.owns_lending_item(uuid),private.is_lending_item_participant(uuid) to authenticated;
revoke all on function public.handle_new_user(),public.owns_lending_item(uuid),public.is_lending_item_participant(uuid) from public,anon,authenticated;
revoke all on function public.approve_borrow_request(uuid),public.reject_borrow_request(uuid),public.create_due_reminders(),public.request_item_return(uuid),public.confirm_item_return(uuid),public.owner_complete_loan(uuid,boolean) from public,anon;
grant execute on function public.approve_borrow_request(uuid),public.reject_borrow_request(uuid),public.create_due_reminders(),public.request_item_return(uuid),public.confirm_item_return(uuid),public.owner_complete_loan(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
