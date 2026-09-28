create policy "firm reads deal files" on storage.objects for select to authenticated
  using (bucket_id = 'deal-files' and public.is_firm_member(((storage.foldername(name))[1])::uuid));
create policy "firm writes deal files" on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-files' and public.is_firm_member(((storage.foldername(name))[1])::uuid));
create policy "firm deletes deal files" on storage.objects for delete to authenticated
  using (bucket_id = 'deal-files' and public.is_firm_member(((storage.foldername(name))[1])::uuid));

create policy "view firm assets" on storage.objects for select to authenticated
  using (bucket_id = 'firm-assets' and public.can_view_firm(((storage.foldername(name))[1])::uuid));
create policy "admin writes firm assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'firm-assets' and public.is_firm_admin(((storage.foldername(name))[1])::uuid));
create policy "admin updates firm assets" on storage.objects for update to authenticated
  using (bucket_id = 'firm-assets' and public.is_firm_admin(((storage.foldername(name))[1])::uuid));
create policy "admin deletes firm assets" on storage.objects for delete to authenticated
  using (bucket_id = 'firm-assets' and public.is_firm_admin(((storage.foldername(name))[1])::uuid));