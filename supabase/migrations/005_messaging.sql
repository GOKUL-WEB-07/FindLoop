-- Apply after 004_complete_workflows.sql.
-- Adds per-user unread state and recipient-only read access for two-way messaging.

alter table public.messages add column if not exists read_at timestamptz;

drop policy if exists "recipient marks messages read" on public.messages;
create policy "recipient marks messages read" on public.messages for update
using(auth.uid()=recipient_id)
with check(auth.uid()=recipient_id);

create index if not exists messages_participants_idx
on public.messages(listing_id,sender_id,recipient_id,created_at desc);

create index if not exists messages_unread_idx
on public.messages(recipient_id,created_at desc)
where read_at is null;
