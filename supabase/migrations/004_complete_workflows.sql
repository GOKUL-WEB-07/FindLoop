-- Apply after migrations 001, 002 and 003.
-- Completes participant RLS, notifications, rejection, and return workflows.

drop policy if exists "transaction parties read" on public.borrow_transactions;
create policy "transaction parties read" on public.borrow_transactions for select
using(auth.uid()=lender_id or auth.uid()=borrower_id);

drop policy if exists "lend readable" on public.lending_items;
create policy "lend participant readable" on public.lending_items for select using(
  status='available' or owner_id=auth.uid()
  or exists(select 1 from public.borrow_requests r where r.item_id=id and r.borrower_id=auth.uid())
  or exists(select 1 from public.borrow_transactions t where t.item_id=id and t.borrower_id=auth.uid())
);

create or replace function public.notify_borrow_request() returns trigger language plpgsql security definer set search_path=public as $$
declare lender uuid; item_title text;
begin
  select owner_id,title into lender,item_title from public.lending_items where id=new.item_id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(lender,'borrow_request','New borrow request','A student requested '||item_title,new.id,'borrow_request');
  return new;
end; $$;
drop trigger if exists notify_on_borrow_request on public.borrow_requests;
create trigger notify_on_borrow_request after insert on public.borrow_requests for each row execute function public.notify_borrow_request();

create or replace function public.notify_new_message() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(new.recipient_id,'new_message','New message',left(new.body,120),new.listing_id,'lost_found_item');
  return new;
end; $$;
drop trigger if exists notify_on_new_message on public.messages;
create trigger notify_on_new_message after insert on public.messages for each row execute function public.notify_new_message();

create or replace function public.reject_borrow_request(p_request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.borrow_requests; lender uuid;
begin
  select * into r from public.borrow_requests where id=p_request_id for update;
  select owner_id into lender from public.lending_items where id=r.item_id;
  if r.id is null or lender<>auth.uid() then raise exception 'Only the owner can reject this request.'; end if;
  if r.status<>'pending' then raise exception 'This request is no longer pending.'; end if;
  update public.borrow_requests set status='rejected' where id=r.id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(r.borrower_id,'borrow_rejected','Borrow request declined','The owner declined your borrowing request.',r.item_id,'lending_item');
end; $$;
grant execute on function public.reject_borrow_request(uuid) to authenticated;

create or replace function public.request_item_return(p_transaction_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.borrow_transactions;
begin
  select * into t from public.borrow_transactions where id=p_transaction_id for update;
  if t.borrower_id<>auth.uid() then raise exception 'Only the borrower can request a return.'; end if;
  if t.status not in ('scheduled','active') then raise exception 'This item cannot be returned from its current state.'; end if;
  update public.borrow_transactions set status='return_requested' where id=t.id;
  update public.lending_items set status='return_pending',updated_at=now() where id=t.item_id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.lender_id,'return_requested','Return awaiting confirmation','The borrower marked your item as returned.',t.id,'borrow_transaction');
end; $$;
grant execute on function public.request_item_return(uuid) to authenticated;

create or replace function public.confirm_item_return(p_transaction_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.borrow_transactions;
begin
  select * into t from public.borrow_transactions where id=p_transaction_id for update;
  if t.lender_id<>auth.uid() then raise exception 'Only the lender can confirm this return.'; end if;
  if t.status<>'return_requested' then raise exception 'A return has not been requested.'; end if;
  update public.borrow_transactions set status='returned',actual_return_date=now() where id=t.id;
  update public.borrow_requests set status='completed' where id=t.request_id;
  update public.lending_items set status='available',updated_at=now() where id=t.item_id;
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.borrower_id,'return_confirmed','Return confirmed','The lender confirmed the item return.',t.id,'borrow_transaction');
end; $$;
grant execute on function public.confirm_item_return(uuid) to authenticated;

create index if not exists borrow_requests_borrower_idx on public.borrow_requests(borrower_id,created_at desc);
create index if not exists transactions_borrower_idx on public.borrow_transactions(borrower_id,status,due_date);
create index if not exists transactions_lender_idx on public.borrow_transactions(lender_id,status,due_date);
