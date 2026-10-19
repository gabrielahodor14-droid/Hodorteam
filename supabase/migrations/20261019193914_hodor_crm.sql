create schema if not exists crm_private;
revoke all on schema crm_private from public,anon;
grant usage on schema crm_private to authenticated;
-- Apply to the selected Supabase project through a reviewed migration.
create table if not exists public.crm_members (email text primary key);
insert into public.crm_members(email) values ('gabrielahodor14@gmail.com') on conflict do nothing;
alter table public.crm_members enable row level security;
revoke all on public.crm_members from anon, authenticated;

create or replace function crm_private.crm_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from auth.users u join public.crm_members m on lower(u.email)=m.email
    where u.id=auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function crm_private.crm_is_member() from public;
grant execute on function crm_private.crm_is_member() to authenticated;


create or replace function public.crm_is_member() returns boolean
language sql stable security invoker set search_path='' as $$select crm_private.crm_is_member();$$;
revoke all on function public.crm_is_member() from public;
grant execute on function public.crm_is_member() to authenticated;

create table if not exists public.crm_records (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  kind text not null check(kind in ('client','viewing')),
  data jsonb not null check(jsonb_typeof(data)='object'),
  row_no bigint generated always as identity unique,
  sync jsonb not null default '{"state":"pending"}',
  calendar_generation integer not null default 0,
  lock_token uuid,
  lock_until timestamptz
);
create index if not exists crm_owner_kind on public.crm_records(owner_id,kind);
alter table public.crm_records enable row level security;
drop policy if exists crm_owner_read on public.crm_records;
create policy crm_owner_read on public.crm_records for select to authenticated
  using (owner_id=(select auth.uid()) and (select public.crm_is_member()));
revoke all on public.crm_records from anon, authenticated;
grant select on public.crm_records to authenticated;

create table if not exists public.crm_google_connections (
  owner_id uuid primary key references auth.users(id),
  refresh_ciphertext text not null
);
alter table public.crm_google_connections enable row level security;
revoke all on public.crm_google_connections from anon, authenticated;
grant all on public.crm_google_connections to service_role;

create or replace function crm_private.crm_save_record(p_kind text,p_id uuid,p_data jsonb,p_expected text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.crm_records; stamp text; saved jsonb;
begin
  if auth.uid() is null or not public.crm_is_member() then raise exception 'Acces nepermis' using errcode='42501'; end if;
  if p_kind not in ('client','viewing') or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>50000 then raise exception 'Date invalide' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into r from public.crm_records where id=p_id for update;
  if found then
    if r.owner_id<>auth.uid() or r.kind<>p_kind then raise exception 'Acces nepermis' using errcode='42501'; end if;
    if r.lock_until>now() then raise exception 'Sincronizare în curs. Încearcă din nou într-un moment.' using errcode='55P03'; end if;
    if (r.data-'id'-'createdAt'-'updatedAt')=p_data then return r.data || jsonb_build_object('sync',r.sync); end if;
    if p_expected is null or p_expected<>r.data->>'updatedAt' then raise exception 'Înregistrarea a fost modificată. Reîncarcă agenda.' using errcode='40001'; end if;
  elsif p_expected is not null then raise exception 'Înregistrarea nu există' using errcode='P0002'; end if;
  if p_kind='viewing' then
    if not exists(select 1 from public.crm_records where id=(p_data->>'clientId')::uuid and owner_id=auth.uid() and kind='client') then raise exception 'Clientul nu există' using errcode='P0002'; end if;
  else
    if exists(select 1 from public.crm_records where owner_id=auth.uid() and kind='viewing' and data->>'clientId'=p_id::text and lock_until>now()) then raise exception 'Vizionarea clientului se sincronizează. Încearcă din nou într-un moment.' using errcode='55P03'; end if;
  end if;
  stamp=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  saved=p_data || jsonb_build_object('id',p_id,'createdAt',coalesce(r.data->>'createdAt',stamp),'updatedAt',stamp);
  if r.id is null then
    insert into public.crm_records(id,owner_id,kind,data) values(p_id,auth.uid(),p_kind,saved);
  else
    update public.crm_records set calendar_generation=calendar_generation+case when kind='viewing' and data->>'status'='cancelled' and p_data->>'status'<>'cancelled' then 1 else 0 end,data=saved,sync='{"state":"pending"}',lock_token=null,lock_until=null where id=p_id;
  end if;
  if p_kind='client' then
    update public.crm_records set sync='{"state":"pending"}' where owner_id=auth.uid() and kind='viewing' and data->>'clientId'=p_id::text;
  end if;
  return saved || '{"sync":{"state":"pending"}}'::jsonb;
end;
$$;
revoke all on function crm_private.crm_save_record(text,uuid,jsonb,text) from public;
grant execute on function crm_private.crm_save_record(text,uuid,jsonb,text) to authenticated;

create or replace function crm_private.crm_claim_sync(p_id uuid,p_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.crm_records; c jsonb;
begin
  if not public.crm_is_member() then raise exception 'Acces nepermis' using errcode='42501'; end if;
  select * into r from public.crm_records where id=p_id and owner_id=auth.uid() for update;
  if not found then raise exception 'Înregistrarea nu există' using errcode='P0002'; end if;
  if r.lock_until>now() then raise exception 'Sincronizare în curs' using errcode='55P03'; end if;
  if r.kind='viewing' then
    -- Lock the client too, so edits cannot race the snapshot sent to Google.
    select data into c from public.crm_records where id=(r.data->>'clientId')::uuid and owner_id=auth.uid() and kind='client' for update;
    if c is null then raise exception 'Clientul nu există' using errcode='P0002'; end if;
  end if;
  update public.crm_records set lock_token=p_token,lock_until=now()+interval '2 minutes' where id=p_id;
  return jsonb_build_object('kind',r.kind,'data',r.data,'row',r.row_no+1,'sync',r.sync,'client',c,'generation',r.calendar_generation);
end;
$$;
revoke all on function crm_private.crm_claim_sync(uuid,uuid) from public;
grant execute on function crm_private.crm_claim_sync(uuid,uuid) to authenticated;

create or replace function crm_private.crm_finish_sync(p_id uuid,p_token uuid,p_version text,p_sync jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not public.crm_is_member() then raise exception 'Acces nepermis' using errcode='42501'; end if;
  update public.crm_records set sync=p_sync,lock_token=null,lock_until=null
    where id=p_id and owner_id=auth.uid() and lock_token=p_token and data->>'updatedAt'=p_version;
  return found;
end;
$$;
revoke all on function crm_private.crm_finish_sync(uuid,uuid,text,jsonb) from public;
grant execute on function crm_private.crm_finish_sync(uuid,uuid,text,jsonb) to authenticated;

-- Public RPC wrappers have no elevated privileges. Privileged implementations are not in an exposed schema.
create or replace function public.crm_save_record(p_kind text,p_id uuid,p_data jsonb,p_expected text default null)
returns jsonb language sql security invoker set search_path='' as $$select crm_private.crm_save_record(p_kind,p_id,p_data,p_expected);$$;
create or replace function public.crm_claim_sync(p_id uuid,p_token uuid)
returns jsonb language sql security invoker set search_path='' as $$select crm_private.crm_claim_sync(p_id,p_token);$$;
create or replace function public.crm_finish_sync(p_id uuid,p_token uuid,p_version text,p_sync jsonb)
returns boolean language sql security invoker set search_path='' as $$select crm_private.crm_finish_sync(p_id,p_token,p_version,p_sync);$$;
revoke all on function public.crm_save_record(text,uuid,jsonb,text),public.crm_claim_sync(uuid,uuid),public.crm_finish_sync(uuid,uuid,text,jsonb) from public;
grant execute on function public.crm_save_record(text,uuid,jsonb,text),public.crm_claim_sync(uuid,uuid),public.crm_finish_sync(uuid,uuid,text,jsonb) to authenticated;
create index if not exists crm_viewing_client on public.crm_records(owner_id,(data->>'clientId')) where kind='viewing';
