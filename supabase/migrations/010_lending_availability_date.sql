-- Repair projects where the lending date part of 007 was not applied.
-- Safe to run after 007 as well; apply in the connected Supabase project's SQL editor.
begin;

alter table public.lending_items
  add column if not exists available_from date;

-- Existing rows created before this column existed cannot recover the date that
-- users selected. Use their creation date as a clearly defined legacy default.
update public.lending_items
set available_from = created_at::date
where available_from is null;

alter table public.lending_items
  alter column available_from set default current_date;
alter table public.lending_items
  alter column available_from set not null;

create index if not exists lending_available_from_idx
  on public.lending_items(status, available_from, created_at desc);

notify pgrst, 'reload schema';
commit;
