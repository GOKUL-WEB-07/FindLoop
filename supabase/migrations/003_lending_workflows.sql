-- Apply after 001 and 002. Enables verified lending, direct messages, and atomic approvals.
alter table public.borrow_requests add column if not exists student_name text;
alter table public.borrow_requests add column if not exists student_email text;
alter table public.borrow_requests add column if not exists student_id_card_url text;
alter table public.lending_items add column if not exists library_name text;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.lost_found_items(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 1500), created_at timestamptz not null default now(), check(sender_id <> recipient_id)
);
alter table public.messages enable row level security;
create policy "message parties can read" on public.messages for select using(auth.uid()=sender_id or auth.uid()=recipient_id);
create policy "sender can send" on public.messages for insert with check(auth.uid()=sender_id);
create index if not exists messages_listing_idx on public.messages(listing_id,created_at);

drop policy if exists "request party read" on public.borrow_requests;
create policy "request parties can read" on public.borrow_requests for select using(borrower_id=auth.uid() or exists(select 1 from public.lending_items i where i.id=item_id and i.owner_id=auth.uid()));

create or replace function public.approve_borrow_request(p_request_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.borrow_requests; owner uuid;
begin
  select * into r from public.borrow_requests where id=p_request_id for update;
  if not found or r.status <> 'pending' then raise exception 'This request is no longer available.'; end if;
  select owner_id into owner from public.lending_items where id=r.item_id for update;
  if owner is null or owner <> auth.uid() then raise exception 'Only the item owner can approve this request.'; end if;
  update public.lending_items set status='borrowed',updated_at=now() where id=r.item_id and status in ('available','requested');
  if not found then raise exception 'This item is not available.'; end if;
  update public.borrow_requests set status='approved' where id=r.id;
  update public.borrow_requests set status='rejected' where item_id=r.item_id and id<>r.id and status='pending';
  insert into public.borrow_transactions(request_id,item_id,lender_id,borrower_id,start_date,due_date,status) values(r.id,r.item_id,owner,r.borrower_id,r.start_date,r.return_date,'scheduled');
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type) values(r.borrower_id,'borrow_approved','Borrow request approved','Your request has been approved. Return the item by '||r.return_date::text,r.item_id,'lending_item');
end; $$;
grant execute on function public.approve_borrow_request(uuid) to authenticated;

create or replace function public.create_due_reminders() returns void language sql security definer set search_path=public as $$
  insert into public.notifications(recipient_id,type,title,message,entity_id,entity_type)
  select t.borrower_id,'due_reminder','Return due soon','Your borrowed item is due on '||t.due_date::text,t.item_id,'lending_item' from public.borrow_transactions t
  where t.status in ('scheduled','active') and t.due_date <= current_date + 1
  and not exists(select 1 from public.notifications n where n.recipient_id=t.borrower_id and n.type='due_reminder' and n.entity_id=t.item_id and n.created_at::date=current_date);
$$;
grant execute on function public.create_due_reminders() to authenticated;
