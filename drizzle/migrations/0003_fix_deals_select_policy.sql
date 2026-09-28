DROP POLICY IF EXISTS "view deals" ON public.deals;
CREATE POLICY "view deals" ON public.deals FOR SELECT TO authenticated
USING (public.is_firm_member(firm_id) OR public.can_view_deal(id));