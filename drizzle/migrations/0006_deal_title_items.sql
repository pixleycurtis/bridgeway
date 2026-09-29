create table public.deal_title_items (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  firm_id uuid not null references public.firms(id),
  section text not null default 'commitment',
  item text not null,
  detail text,
  status text not null default 'open',
  due_date date,
  file_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.deal_title_items to authenticated;
grant all on public.deal_title_items to service_role;

alter table public.deal_title_items enable row level security;

create policy "view title items"
  on public.deal_title_items for select
  to authenticated
  using (public.can_view_deal(deal_id));

create policy "edit title items insert"
  on public.deal_title_items for insert
  to authenticated
  with check (public.can_edit_deal(deal_id));

create policy "edit title items update"
  on public.deal_title_items for update
  to authenticated
  using (public.can_edit_deal(deal_id))
  with check (public.can_edit_deal(deal_id));

create policy "edit title items delete"
  on public.deal_title_items for delete
  to authenticated
  using (public.can_edit_deal(deal_id));

create index deal_title_items_deal_idx on public.deal_title_items(deal_id);