ALTER TABLE public.deal_parties ADD COLUMN user_id uuid;
ALTER TABLE public.deal_dd_items ADD COLUMN assigned_role text;
ALTER TABLE public.deal_title_items ADD COLUMN assigned_role text;
ALTER TABLE public.deal_tasks ADD COLUMN assigned_role text;
ALTER TABLE public.deal_tasks ADD COLUMN shared_with text[] NOT NULL DEFAULT '{}';

-- One table for item threads and deal-level channels (item_type = 'deal', item_id = deal_id).
CREATE TABLE public.item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('request','title','task','deal')),
  item_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('internal','seller','title','lender','counsel')),
  author_user uuid,
  author_party uuid REFERENCES public.deal_parties(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_comments_item_idx ON public.item_comments (item_id, audience, created_at);
CREATE INDEX item_comments_deal_idx ON public.item_comments (deal_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.item_comments TO authenticated;
GRANT ALL ON public.item_comments TO service_role;
ALTER TABLE public.item_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments select" ON public.item_comments FOR SELECT TO authenticated USING (public.can_edit_deal(deal_id));
CREATE POLICY "comments insert" ON public.item_comments FOR INSERT TO authenticated WITH CHECK (public.can_edit_deal(deal_id) AND author_user = auth.uid() AND author_party IS NULL);
CREATE POLICY "comments delete" ON public.item_comments FOR DELETE TO authenticated USING (author_user = auth.uid());

-- Invited outside parties must not get a workspace of their own.
CREATE OR REPLACE FUNCTION public.ensure_membership()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  if _firm is null and _email <> '' and exists(select 1 from deal_parties where lower(email) = _email and revoked_at is null) then
    update deal_parties set user_id = _uid where lower(email) = _email and user_id is null;
    return jsonb_build_object('firm_id', null, 'created', false, 'party_only', true);
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
end $function$;