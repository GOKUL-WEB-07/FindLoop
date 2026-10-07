begin;
create or replace function public.approve_borrow_request(p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.borrow_requests; i public.lending_items; item_id_to_lock uuid;
begin
 if auth.uid() is null then raise exception 'Please sign in.'; end if;
 select item_id into item_id_to_lock from public.borrow_requests where id=p_request_id;
 select * into i from public.lending_items where id=item_id_to_lock for update;
 if not found or i.owner_id is distinct from auth.uid() then raise exception 'Only the item owner can approve this request.'; end if;
 select * into r from public.borrow_requests where id=p_request_id for update;
 if not found or r.status<>'pending' then raise exception 'This request is no longer pending.'; end if;
 if i.status<>'available' then raise exception 'This item is not available.'; end if;
 if r.start_date<current_date or r.start_date<i.available_from or r.return_date-r.start_date>i.max_borrow_days then raise exception 'The requested dates are no longer valid. Ask the borrower to send a new request.'; end if;
 update public.borrow_requests set status='approved' where id=r.id;
 insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
 select borrower_id,'borrow_rejected','Borrow request declined','Another request was approved for this item.',item_id,'lending_item' from public.borrow_requests where item_id=r.item_id and id<>r.id and status='pending';
 update public.borrow_requests set status='rejected' where item_id=r.item_id and id<>r.id and status='pending';
 update public.lending_items set status='borrowed',updated_at=now() where id=i.id;
 insert into public.borrow_transactions(request_id,item_id,lender_id,borrower_id,start_date,due_date,status) values(r.id,i.id,i.owner_id,r.borrower_id,r.start_date,r.return_date,case when r.start_date>current_date then 'scheduled' else 'active' end);
 insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type) values(r.borrower_id,'borrow_approved','Borrow request approved','Your request has been approved. Return the item by '||r.return_date::text,i.id,'lending_item');
end; $$;
create or replace function public.reject_borrow_request(p_request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.borrow_requests; lender uuid; item_id_to_lock uuid;
begin
 if auth.uid() is null then raise exception 'Please sign in.'; end if;
 select item_id into item_id_to_lock from public.borrow_requests where id=p_request_id;
 select owner_id into lender from public.lending_items where id=item_id_to_lock for update;
 if lender is distinct from auth.uid() then raise exception 'Only the owner can reject this request.'; end if;
 select * into r from public.borrow_requests where id=p_request_id for update;
 if not found or r.status<>'pending' then raise exception 'This request is no longer pending.'; end if;
 update public.borrow_requests set status='rejected' where id=r.id;
 insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type) values(r.borrower_id,'borrow_rejected','Borrow request declined','The owner declined your borrowing request.',r.item_id,'lending_item');
end; $$;
create or replace function public.create_due_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Please sign in.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
 select t.borrower_id,'due_reminder','Return due soon','Your borrowed item is due on '||t.due_date::text,t.id,'borrow_transaction' from public.borrow_transactions t
 where t.borrower_id=auth.uid() and t.status in ('scheduled','active') and t.due_date<=current_date+1
 and not exists(select 1 from public.notifications n where n.recipient_id=t.borrower_id and n.type='due_reminder' and ((n.entity_id=t.id and n.entity_type='borrow_transaction') or n.entity_id=t.item_id) and n.created_at::date=current_date);
end; $$;
create or replace function public.request_item_return(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.borrow_transactions;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into t
  from public.borrow_transactions
  where id=p_transaction_id
  for update;

  if t.id is null then
    raise exception 'Borrowing transaction not found.';
  end if;
  if t.borrower_id<>auth.uid() then
    raise exception 'Only the borrower can request a return.';
  end if;
  if t.status not in ('scheduled','active') then
    raise exception 'This item cannot be returned from its current state.';
  end if;

  update public.borrow_transactions
  set status='return_requested'
  where id=t.id;

  update public.lending_items
  set status='return_pending',updated_at=now()
  where id=t.item_id;

  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.lender_id,'return_requested','Return awaiting confirmation',
    'The borrower marked your item as returned. Confirm after receiving it.',t.item_id,'lending_item');
end;
$$;

create or replace function public.confirm_item_return(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.borrow_transactions;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into t
  from public.borrow_transactions
  where id=p_transaction_id
  for update;

  if t.id is null then
    raise exception 'Borrowing transaction not found.';
  end if;
  if t.lender_id<>auth.uid() then
    raise exception 'Only the lender can confirm this return.';
  end if;
  if t.status<>'return_requested' then
    raise exception 'The borrower has not requested a return.';
  end if;

  update public.borrow_transactions
  set status='returned',actual_return_date=now()
  where id=t.id;

  update public.borrow_requests
  set status='completed'
  where id=t.request_id;

  update public.lending_items
  set status='available',updated_at=now()
  where id=t.item_id;

  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.borrower_id,'return_confirmed','Return confirmed',
    'The owner confirmed the return. The item is available again.',t.item_id,'lending_item');
end;
$$;

-- Used from the owner detail screen when the owner confirms the physical
-- return and chooses whether to relist or remove the item.
create or replace function public.owner_complete_loan(
  p_transaction_id uuid,
  p_archive boolean default false
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.borrow_transactions;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  select * into t
  from public.borrow_transactions
  where id=p_transaction_id
  for update;

  if t.id is null then
    raise exception 'Borrowing transaction not found.';
  end if;
  if t.lender_id<>auth.uid() then
    raise exception 'Only the item owner can complete this loan.';
  end if;
  if t.status in ('returned','cancelled') then
    raise exception 'This loan is already complete.';
  end if;

  update public.borrow_transactions
  set status='returned',actual_return_date=now()
  where id=t.id;

  update public.borrow_requests
  set status='completed'
  where id=t.request_id;

  update public.lending_items
  set status=case when p_archive then 'archived' else 'available' end,
      archived_at=case when p_archive then now() else null end,
      updated_at=now()
  where id=t.item_id;

  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  values(t.borrower_id,'return_confirmed','Return confirmed',
    case when p_archive
      then 'The owner confirmed the return and removed the listing.'
      else 'The owner confirmed the return. The item is available again.'
    end,t.item_id,'lending_item');
end;
$$;

revoke all on function public.request_item_return(uuid) from public;
revoke all on function public.confirm_item_return(uuid) from public;
revoke all on function public.owner_complete_loan(uuid,boolean) from public;
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


revoke all on function public.approve_borrow_request(uuid),public.reject_borrow_request(uuid),public.create_due_reminders(),public.request_item_return(uuid),public.confirm_item_return(uuid),public.owner_complete_loan(uuid,boolean),public.handle_new_user(),public.notify_borrow_request(),public.notify_new_message() from public,anon;
revoke all on function public.handle_new_user(),public.notify_borrow_request(),public.notify_new_message() from authenticated;
grant execute on function public.approve_borrow_request(uuid),public.reject_borrow_request(uuid),public.create_due_reminders(),public.request_item_return(uuid),public.confirm_item_return(uuid),public.owner_complete_loan(uuid,boolean) to authenticated;
notify pgrst,'reload schema';commit;
