-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run. It only adds the Gumroad key table and does not touch anything else (safe to run again).
-- ---- Gumroad card subscriptions: one licence key works on one PC (anti-sharing). Safe to run again. ----
create table if not exists public.gumroad_keys (
  key_hash   text primary key,
  device_id  text not null,
  bound_at   timestamptz not null default now()
);
alter table public.gumroad_keys enable row level security;
create or replace function public.cf_bind_key(p_id text, p_hash text) returns text
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  if p_id is null or p_hash is null or length(p_hash) <> 64 then return 'bad'; end if;
  select device_id into d from gumroad_keys where key_hash = p_hash;
  if d is null then insert into gumroad_keys(key_hash, device_id) values (p_hash, p_id) on conflict do nothing; select device_id into d from gumroad_keys where key_hash = p_hash; end if;
  return case when d = p_id then 'ok' else 'other' end;
end $$;
create or replace function public.cf_unbind_key(p_id text, p_hash text) returns boolean
language plpgsql security definer set search_path = public as $$
begin delete from gumroad_keys where key_hash = p_hash and device_id = p_id; return true; end $$;
revoke all on function public.cf_bind_key(text, text), public.cf_unbind_key(text, text) from public;
grant execute on function public.cf_bind_key(text, text), public.cf_unbind_key(text, text) to anon, authenticated;
