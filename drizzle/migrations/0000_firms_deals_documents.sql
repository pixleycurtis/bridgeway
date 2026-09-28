create type public.firm_role as enum ('admin','analyst','broker','property_manager','legal');

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  logo_path text,
  brand_color text not null default '#1f4d3a',
  doc_font text not null default 'serif',
  contact_name text, contact_email text, contact_phone text, address text,
  style_profile text,
  created_at timestamptz not null default now()
);
grant select, update on public.firms to authenticated;
grant all on public.firms to service_role;
alter table public.firms enable row level security;

create table public.firm_members (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null unique,
  email text not null,
  full_name text,
  role public.firm_role not null default 'analyst',
  created_at timestamptz not null default now()
);
grant select, update, delete on public.firm_members to authenticated;
grant all on public.firm_members to service_role;
alter table public.firm_members enable row level security;

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  name text not null,
  address text not null default '',
  market text not null default '',
  stage text not null default 'Screening',
  assumptions jsonb not null,
  lines jsonb not null,
  adjustments jsonb not null default '[]',
  target_irr numeric not null default 0.15,
  created_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.deals to authenticated;
grant all on public.deals to service_role;
alter table public.deals enable row level security;

create table public.deal_shares (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  email text not null,
  party text not null default 'lender',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (deal_id, email)
);
grant select, insert, delete on public.deal_shares to authenticated;
grant all on public.deal_shares to service_role;
alter table public.deal_shares enable row level security;

create table public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind text not null,
  title text not null,
  sections jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (deal_id, kind)
);
grant select, insert, update, delete on public.deal_documents to authenticated;
grant all on public.deal_documents to service_role;
alter table public.deal_documents enable row level security;

create table public.deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind text not null,
  name text not null,
  path text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.deal_files to authenticated;
grant all on public.deal_files to service_role;
alter table public.deal_files enable row level security;

create table public.style_samples (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  name text not null,
  excerpt text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.style_samples to authenticated;
grant all on public.style_samples to service_role;
alter table public.style_samples enable row level security;

create or replace function public.my_firm_id() returns uuid language sql stable security definer set search_path=public as $$
  select firm_id from public.firm_members where user_id = auth.uid()
$$;
create or replace function public.is_firm_member(_firm uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.firm_members where user_id = auth.uid() and firm_id = _firm)
$$;
create or replace function public.is_firm_admin(_firm uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.firm_members where user_id = auth.uid() and firm_id = _firm and role = 'admin')
$$;
create or replace function public.can_edit_deal(_deal uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.deals d join public.firm_members m on m.firm_id = d.firm_id where d.id = _deal and m.user_id = auth.uid())
$$;
create or replace function public.can_view_deal(_deal uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.can_edit_deal(_deal) or exists(
    select 1 from public.deal_shares s where s.deal_id = _deal and lower(s.email) = lower(coalesce(auth.jwt()->>'email',''))
  )
$$;
create or replace function public.can_view_firm(_firm uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.is_firm_member(_firm) or exists(
    select 1 from public.deals d join public.deal_shares s on s.deal_id = d.id
    where d.firm_id = _firm and lower(s.email) = lower(coalesce(auth.jwt()->>'email',''))
  )
$$;

create policy "view firm" on public.firms for select to authenticated using (public.can_view_firm(id));
create policy "admin updates firm" on public.firms for update to authenticated using (public.is_firm_admin(id)) with check (public.is_firm_admin(id));

create policy "members see members" on public.firm_members for select to authenticated using (public.is_firm_member(firm_id));
create policy "admin updates members" on public.firm_members for update to authenticated using (public.is_firm_admin(firm_id)) with check (public.is_firm_admin(firm_id));
create policy "admin removes members" on public.firm_members for delete to authenticated using (public.is_firm_admin(firm_id) and user_id <> auth.uid());

create policy "view deals" on public.deals for select to authenticated using (public.can_view_deal(id));
create policy "insert deals" on public.deals for insert to authenticated with check (public.is_firm_member(firm_id));
create policy "update deals" on public.deals for update to authenticated using (public.is_firm_member(firm_id)) with check (public.is_firm_member(firm_id));
create policy "delete deals" on public.deals for delete to authenticated using (public.is_firm_member(firm_id));

create policy "view shares" on public.deal_shares for select to authenticated using (public.can_edit_deal(deal_id) or lower(email) = lower(coalesce(auth.jwt()->>'email','')));
create policy "add shares" on public.deal_shares for insert to authenticated with check (public.can_edit_deal(deal_id));
create policy "remove shares" on public.deal_shares for delete to authenticated using (public.can_edit_deal(deal_id));

create policy "view docs" on public.deal_documents for select to authenticated using (public.can_view_deal(deal_id));
create policy "insert docs" on public.deal_documents for insert to authenticated with check (public.can_edit_deal(deal_id));
create policy "update docs" on public.deal_documents for update to authenticated using (public.can_edit_deal(deal_id)) with check (public.can_edit_deal(deal_id));
create policy "delete docs" on public.deal_documents for delete to authenticated using (public.can_edit_deal(deal_id));

create policy "view files" on public.deal_files for select to authenticated using (public.can_edit_deal(deal_id));
create policy "add files" on public.deal_files for insert to authenticated with check (public.can_edit_deal(deal_id));
create policy "remove files" on public.deal_files for delete to authenticated using (public.can_edit_deal(deal_id));

create policy "view samples" on public.style_samples for select to authenticated using (public.is_firm_member(firm_id));
create policy "add samples" on public.style_samples for insert to authenticated with check (public.is_firm_member(firm_id));
create policy "remove samples" on public.style_samples for delete to authenticated using (public.is_firm_member(firm_id));

create or replace function public.ensure_membership() returns jsonb language plpgsql security definer set search_path=public as $$
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt()->>'email',''));
  _name text := coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name', split_part(lower(coalesce(auth.jwt()->>'email','')),'@',1));
  _domain text := split_part(lower(coalesce(auth.jwt()->>'email','')),'@',2);
  _free text[] := array['gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','yahoo.com','icloud.com','me.com','aol.com','proton.me','protonmail.com','gmx.com','msn.com'];
  _firm uuid;
  _created boolean := false;
begin
  if _uid is null then raise exception 'not signed in'; end if;
  select firm_id into _firm from firm_members where user_id = _uid;
  if _firm is not null then return jsonb_build_object('firm_id', _firm, 'created', false); end if;
  if _domain <> '' and not (_domain = any(_free)) then
    select id into _firm from firms where domain = _domain;
  end if;
  if _firm is null then
    insert into firms(name, domain, contact_name, contact_email)
    values (
      case when _domain = any(_free) or _domain = '' then _name || '''s workspace'
           else initcap(split_part(_domain,'.',1)) end,
      case when _domain = any(_free) or _domain = '' then null else _domain end,
      _name, _email)
    returning id into _firm;
    _created := true;
    insert into firm_members(firm_id,user_id,email,full_name,role) values (_firm,_uid,_email,_name,'admin');
  else
    insert into firm_members(firm_id,user_id,email,full_name,role) values (_firm,_uid,_email,_name,'analyst');
  end if;
  return jsonb_build_object('firm_id', _firm, 'created', _created);
end $$;
revoke execute on function public.ensure_membership() from public, anon;
grant execute on function public.ensure_membership() to authenticated;