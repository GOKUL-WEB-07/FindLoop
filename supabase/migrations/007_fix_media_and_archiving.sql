-- Apply after the earlier migrations. Safe to run if 006 was not applied.
begin;

-- Keep this repair migration independent from 005/006 so it can be applied
-- directly to projects where one of those migrations was skipped.
alter table public.messages add column if not exists read_at timestamptz;
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

revoke update on public.messages from authenticated, anon;
grant update(read_at) on public.messages to authenticated;

drop policy if exists "recipient marks messages read" on public.messages;
create policy "recipient marks messages read" on public.messages for update
using(auth.uid()=recipient_id)
with check(auth.uid()=recipient_id);

create index if not exists messages_participants_idx
on public.messages(listing_id,sender_id,recipient_id,created_at desc);
create index if not exists messages_unread_idx
on public.messages(recipient_id,created_at desc)
where read_at is null;

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

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "avatars publicly readable" on storage.objects;
create policy "avatars publicly readable" on storage.objects for select using(bucket_id='avatars');
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects for insert to authenticated
with check(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);
drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects for update to authenticated
using(bucket_id='avatars' and owner_id=auth.uid()::text)
with check(bucket_id='avatars' and owner_id=auth.uid()::text);
drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects for delete to authenticated
using(bucket_id='avatars' and owner_id=auth.uid()::text);

alter table public.lending_items add column if not exists archived_at timestamptz;
alter table public.lending_items add column if not exists available_from date;
update public.lending_items
set available_from=created_at::date
where available_from is null;
alter table public.lending_items alter column available_from set default current_date;
alter table public.lending_items alter column available_from set not null;
create index if not exists lending_available_from_idx
on public.lending_items(status,available_from,created_at desc);

alter table public.borrow_transactions enable row level security;
drop policy if exists "transaction parties read" on public.borrow_transactions;
create policy "transaction parties read" on public.borrow_transactions for select
using(auth.uid()=lender_id or auth.uid()=borrower_id);

drop policy if exists "lend readable" on public.lending_items;
drop policy if exists "lend participant readable" on public.lending_items;
create policy "lend participant readable" on public.lending_items for select using(
  status='available' or owner_id=auth.uid()
  or exists(select 1 from public.borrow_requests r where r.item_id=id and r.borrower_id=auth.uid())
  or exists(select 1 from public.borrow_transactions t where t.item_id=id and t.borrower_id=auth.uid())
);

create or replace function public.request_item_return(p_transaction_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.borrow_transactions;
begin
  select * into t from public.borrow_transactions where id=p_transaction_id for update;
  if t.borrower_id<>auth.uid() then raise exception 'Only the borrower can request a return.'; end if;
  if t.status not in ('scheduled','active') then raise exception 'This item cannot be returned from its current state.'; end if;
  update public.borrow_transactions set status='return_requested' where id=t.id;
  update public.lending_items set status=case when archived_at is null then 'return_pending' else 'archived' end,updated_at=now() where id=t.item_id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.lender_id,'return_requested','Return awaiting confirmation','The borrower marked your item as returned.',t.id,'borrow_transaction');
end; $$;

create or replace function public.confirm_item_return(p_transaction_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.borrow_transactions;
begin
  select * into t from public.borrow_transactions where id=p_transaction_id for update;
  if t.lender_id<>auth.uid() then raise exception 'Only the lender can confirm this return.'; end if;
  if t.status<>'return_requested' then raise exception 'A return has not been requested.'; end if;
  update public.borrow_transactions set status='returned',actual_return_date=now() where id=t.id;
  update public.borrow_requests set status='completed' where id=t.request_id;
  update public.lending_items set status=case when archived_at is null then 'available' else 'archived' end,updated_at=now() where id=t.item_id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.borrower_id,'return_confirmed','Return confirmed','The lender confirmed the item return.',t.id,'borrow_transaction');
end; $$;

create or replace function public.owner_complete_loan(p_transaction_id uuid,p_archive boolean default false) returns void language plpgsql security definer set search_path=public as $$
declare t public.borrow_transactions;
begin
  select * into t from public.borrow_transactions where id=p_transaction_id for update;
  if t.id is null then raise exception 'Borrowing transaction not found.'; end if;
  if t.lender_id<>auth.uid() then raise exception 'Only the item owner can complete this loan.'; end if;
  if t.status in ('returned','cancelled') then raise exception 'This loan is already complete.'; end if;
  update public.borrow_transactions set status='returned',actual_return_date=now() where id=t.id;
  update public.borrow_requests set status='completed' where id=t.request_id;
  update public.lending_items set status=case when p_archive then 'archived' else 'available' end,
    archived_at=case when p_archive then now() else null end,updated_at=now() where id=t.item_id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.borrower_id,'return_confirmed','Loan completed',case when p_archive then 'The owner confirmed the return and removed the listing.' else 'The owner confirmed the return. The item is available again.' end,t.id,'borrow_transaction');
end; $$;

grant execute on function public.request_item_return(uuid) to authenticated;
grant execute on function public.confirm_item_return(uuid) to authenticated;
grant execute on function public.owner_complete_loan(uuid,boolean) to authenticated;

create or replace function public.create_due_reminders() returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  select t.borrower_id,
    case when t.due_date<current_date then 'borrow_overdue' else 'borrow_due_soon' end,
    case when t.due_date<current_date then 'Borrowed item overdue' else 'Borrowed item due soon' end,
    case when t.due_date<current_date then 'Your borrowed item was due on ' else 'Your borrowed item is due on ' end||t.due_date::text,
    t.id,'borrow_transaction'
  from public.borrow_transactions t
  where t.borrower_id=auth.uid() and t.status in ('scheduled','active') and t.due_date<=current_date+1
    and not exists(select 1 from public.notifications n where n.recipient_id=t.borrower_id
      and n.type=case when t.due_date<current_date then 'borrow_overdue' else 'borrow_due_soon' end
      and n.entity_id=t.id and n.created_at::date=current_date);

  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  select t.lender_id,
    case when t.due_date<current_date then 'lend_overdue' else 'lend_due_soon' end,
    case when t.due_date<current_date then 'Lent item overdue' else 'Lent item due soon' end,
    case when t.due_date<current_date then 'Your lent item was due on ' else 'Your lent item is due on ' end||t.due_date::text,
    t.id,'borrow_transaction'
  from public.borrow_transactions t
  where t.lender_id=auth.uid() and t.status in ('scheduled','active') and t.due_date<=current_date+1
    and not exists(select 1 from public.notifications n where n.recipient_id=t.lender_id
      and n.type=case when t.due_date<current_date then 'lend_overdue' else 'lend_due_soon' end
      and n.entity_id=t.id and n.created_at::date=current_date);
end; $$;
grant execute on function public.create_due_reminders() to authenticated;
notify pgrst, 'reload schema';
commit;
