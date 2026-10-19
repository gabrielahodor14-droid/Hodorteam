-- Keep the membership list outside the Data API.
alter table public.crm_members set schema crm_private;
create or replace function crm_private.crm_is_member() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from auth.users u join crm_private.crm_members m on lower(u.email)=m.email
    where u.id=auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function crm_private.crm_is_member() from public,anon,authenticated;
grant execute on function crm_private.crm_is_member() to authenticated;

-- Only authenticated owners can access their own encrypted provider credentials.
-- The encryption key is held on the application server, never in this database or browser.
create policy crm_google_owner_read on public.crm_google_connections for select to authenticated
  using(owner_id=(select auth.uid()) and (select public.crm_is_member()));
create policy crm_google_owner_insert on public.crm_google_connections for insert to authenticated
  with check(owner_id=(select auth.uid()) and (select public.crm_is_member()));
create policy crm_google_owner_update on public.crm_google_connections for update to authenticated
  using(owner_id=(select auth.uid()) and (select public.crm_is_member()))
  with check(owner_id=(select auth.uid()) and (select public.crm_is_member()));
grant select,insert,update on public.crm_google_connections to authenticated;

-- Supabase may explicitly grant API roles EXECUTE by default; revoke these in addition to PUBLIC.
revoke all on function public.crm_is_member(),public.crm_save_record(text,uuid,jsonb,text),public.crm_claim_sync(uuid,uuid),public.crm_finish_sync(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_is_member(),public.crm_save_record(text,uuid,jsonb,text),public.crm_claim_sync(uuid,uuid),public.crm_finish_sync(uuid,uuid,text,jsonb) to authenticated;
-- An existing automatic-RLS event trigger only needs to run inside PostgreSQL, not via the REST API.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
  end if;
end; $$;
