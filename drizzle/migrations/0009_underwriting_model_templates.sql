ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS model jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE public.underwrite_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  name text NOT NULL,
  model_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.underwrite_templates TO authenticated;
GRANT ALL ON public.underwrite_templates TO service_role;
ALTER TABLE public.underwrite_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read templates" ON public.underwrite_templates FOR SELECT TO authenticated USING (public.is_firm_member(firm_id));
CREATE POLICY "members add templates" ON public.underwrite_templates FOR INSERT TO authenticated WITH CHECK (public.is_firm_member(firm_id));
CREATE POLICY "members edit templates" ON public.underwrite_templates FOR UPDATE TO authenticated USING (public.is_firm_member(firm_id)) WITH CHECK (public.is_firm_member(firm_id));
CREATE POLICY "members delete templates" ON public.underwrite_templates FOR DELETE TO authenticated USING (public.is_firm_member(firm_id));