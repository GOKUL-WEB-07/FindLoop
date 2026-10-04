-- Standalone two-step return workflow. Safe to apply after the initial schema.
begin;

create or replace function public.request_item_return(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  t public.borrow_transactions;
begin
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
set search_path=public
as $$
declare
  t public.borrow_transactions;
begin
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
set search_path=public
as $$
declare
  t public.borrow_transactions;
begin
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
grant execute on function public.request_item_return(uuid) to authenticated;
grant execute on function public.confirm_item_return(uuid) to authenticated;
grant execute on function public.owner_complete_loan(uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
