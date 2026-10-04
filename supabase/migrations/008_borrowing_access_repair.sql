-- Repair visibility for approved borrowers and lenders without rerunning the larger workflow migration.
begin;

alter table public.lending_items enable row level security;
alter table public.borrow_requests enable row level security;
alter table public.borrow_transactions enable row level security;

grant select on public.lending_items to authenticated;
grant select on public.borrow_requests to authenticated;
grant select on public.borrow_transactions to authenticated;

-- Policy helper functions deliberately run as their owner so the checks do not
-- recursively invoke the policies on the related tables.
create or replace function public.owns_lending_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.lending_items i
    where i.id=p_item_id and i.owner_id=auth.uid()
  );
$$;

create or replace function public.is_lending_item_participant(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    exists(
      select 1 from public.borrow_requests r
      where r.item_id=p_item_id and r.borrower_id=auth.uid()
    )
    or exists(
      select 1 from public.borrow_transactions t
      where t.item_id=p_item_id
        and (t.borrower_id=auth.uid() or t.lender_id=auth.uid())
    );
$$;

revoke all on function public.owns_lending_item(uuid) from public;
revoke all on function public.is_lending_item_participant(uuid) from public;
grant execute on function public.owns_lending_item(uuid) to authenticated;
grant execute on function public.is_lending_item_participant(uuid) to authenticated;

drop policy if exists "lend readable" on public.lending_items;
drop policy if exists "lend participant readable" on public.lending_items;
create policy "lend participant readable" on public.lending_items for select to authenticated using(
  status='available' or owner_id=auth.uid()
  or public.is_lending_item_participant(id)
);

drop policy if exists "request party read" on public.borrow_requests;
drop policy if exists "request parties can read" on public.borrow_requests;
create policy "request parties can read" on public.borrow_requests for select to authenticated using(
  borrower_id=auth.uid()
  or public.owns_lending_item(item_id)
);

drop policy if exists "transaction parties read" on public.borrow_transactions;
create policy "transaction parties read" on public.borrow_transactions for select to authenticated using(
  borrower_id=auth.uid() or lender_id=auth.uid()
);

create index if not exists borrow_requests_borrower_idx on public.borrow_requests(borrower_id,created_at desc);
create index if not exists transactions_borrower_idx on public.borrow_transactions(borrower_id,status,due_date);
create index if not exists transactions_lender_idx on public.borrow_transactions(lender_id,status,due_date);

notify pgrst, 'reload schema';
commit;
