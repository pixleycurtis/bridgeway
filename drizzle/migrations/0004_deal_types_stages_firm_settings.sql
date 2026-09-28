ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'Multifamily',
  ADD COLUMN IF NOT EXISTS stage_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pass_reason text,
  ADD COLUMN IF NOT EXISTS asking_price numeric,
  ADD COLUMN IF NOT EXISTS final_price numeric;
UPDATE public.deals SET stage_history = jsonb_build_array(jsonb_build_object('stage', stage, 'at', created_at)) WHERE stage_history = '[]'::jsonb;
UPDATE public.deals SET asking_price = (assumptions->>'price')::numeric WHERE asking_price IS NULL;
ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;