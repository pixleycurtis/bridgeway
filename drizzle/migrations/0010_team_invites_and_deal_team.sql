CREATE TABLE public.firm_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.firm_role NOT NULL DEFAULT 'analyst',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (firm_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firm_invites TO authenticated;
GRANT ALL ON public.firm_invites TO service_role;
ALTER TABLE public.firm_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view invites" ON public.firm_invites FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));
CREATE POLICY "admins add invites" ON public.firm_invites FOR INSERT TO authenticated WITH CHECK (public.is_firm_admin(firm_id));
CREATE POLICY "admins edit invites" ON public.firm_invites FOR UPDATE TO authenticated USING (public.is_firm_admin(firm_id));
CREATE POLICY "admins remove invites" ON public.firm_invites FOR DELETE TO authenticated USING (public.is_firm_admin(firm_id));

ALTER TABLE public.deals ADD COLUMN team uuid[] NOT NULL DEFAULT '{}';

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
  _role public.firm_role := 'analyst';
  _created boolean := false;
begin
  if _uid is null then raise exception 'not signed in'; end if;
  select firm_id into _firm from firm_members where user_id = _uid;
  if _firm is not null then return jsonb_build_object('firm_id', _firm, 'created', false); end if;
  if _email <> '' then
    select firm_id, role into _firm, _role from firm_invites where lower(email) = _email order by created_at limit 1;
    if _firm is not null then
      insert into firm_members(firm_id,user_id,email,full_name,role) values (_firm,_uid,_email,_name,_role);
      delete from firm_invites where lower(email) = _email and firm_id = _firm;
      return jsonb_build_object('firm_id', _firm, 'created', false);
    end if;
    _role := 'analyst';
  end if;
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