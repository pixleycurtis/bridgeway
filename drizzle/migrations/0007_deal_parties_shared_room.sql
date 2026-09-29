CREATE TABLE public.deal_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'seller' CHECK (role IN ('seller','title','lender','counsel')),
  token_hash text UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_parties TO authenticated;
GRANT ALL ON public.deal_parties TO service_role;
ALTER TABLE public.deal_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties select" ON public.deal_parties FOR SELECT TO authenticated USING (public.can_edit_deal(deal_id));
CREATE POLICY "parties insert" ON public.deal_parties FOR INSERT TO authenticated WITH CHECK (public.can_edit_deal(deal_id));
CREATE POLICY "parties update" ON public.deal_parties FOR UPDATE TO authenticated USING (public.can_edit_deal(deal_id)) WITH CHECK (public.can_edit_deal(deal_id));
CREATE POLICY "parties delete" ON public.deal_parties FOR DELETE TO authenticated USING (public.can_edit_deal(deal_id));

INSERT INTO public.deal_parties (deal_id, email, role, created_by, created_at)
SELECT deal_id, lower(email), CASE party WHEN 'lender' THEN 'lender' WHEN 'title' THEN 'title' WHEN 'seller' THEN 'seller' ELSE 'counsel' END, created_by, created_at
FROM public.deal_shares;
COMMENT ON TABLE public.deal_shares IS 'DEPRECATED: replaced by deal_parties (role-scoped guest links)';

CREATE TABLE public.deal_party_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid REFERENCES public.deal_parties(id) ON DELETE SET NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_party_events TO authenticated;
GRANT ALL ON public.deal_party_events TO service_role;
ALTER TABLE public.deal_party_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events select" ON public.deal_party_events FOR SELECT TO authenticated USING (public.can_edit_deal(deal_id));

ALTER TABLE public.deal_dd_items ADD COLUMN shared_with text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.deal_title_items ADD COLUMN shared_with text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.deal_files ADD COLUMN shared_with text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.deal_documents ADD COLUMN shared_with text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.deal_dd_items ADD COLUMN impact jsonb;
ALTER TABLE public.deal_title_items ADD COLUMN impact jsonb;

-- Outside parties no longer read the private workspace; they only see the guest room.
CREATE OR REPLACE FUNCTION public.can_view_deal(_deal uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select public.can_edit_deal(_deal) $$;

CREATE OR REPLACE FUNCTION public.can_view_firm(_firm uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select public.is_firm_member(_firm) $$;