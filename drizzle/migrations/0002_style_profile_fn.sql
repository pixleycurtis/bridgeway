create or replace function public.set_style_profile(_profile text) returns void language plpgsql security definer set search_path=public as $$
declare _firm uuid := public.my_firm_id();
begin
  if _firm is null then raise exception 'no firm'; end if;
  update public.firms set style_profile = _profile where id = _firm;
end $$;
revoke execute on function public.set_style_profile(text) from public, anon;
grant execute on function public.set_style_profile(text) to authenticated;