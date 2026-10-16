-- ClipForge licenses. Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- BEFORE running: change YOUR_OWNER_PASSWORD (last lines) to the password you want for the owner panel.
create extension if not exists pgcrypto;

create table if not exists public.licenses (
  id          text primary key,                 -- the PC id, e.g. CF-1A2B-3C4D-5E6F-7A8B
  pro         boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.owner_secret (
  id      int primary key default 1,
  pw_hash text not null
);
-- Row level security ON and NO policies: nobody can read or write the tables directly with the public (anon) key.
alter table public.licenses     enable row level security;
alter table public.owner_secret enable row level security;

-- password check (not callable from the app directly)
create or replace function public._cf_owner_ok(p_pw text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists(select 1 from owner_secret where pw_hash = crypt(coalesce(p_pw, ''), pw_hash)) into ok;
  if not ok then perform pg_sleep(1); end if;     -- slows down password guessing
  return ok;
end $$;
revoke all on function public._cf_owner_ok(text) from public, anon, authenticated;

-- the app asks: is this PC pro?
create or replace function public.cf_get_pro(p_id text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select pro from licenses where id = p_id), false)
$$;

-- the app registers a PC id when the buyer taps "Get my ID" (starts as free)
create or replace function public.cf_register(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^CF-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then raise exception 'bad id'; end if;
  insert into licenses(id, pro) values (p_id, false) on conflict (id) do nothing;
end $$;

-- owner functions (every one needs the owner password)
create or replace function public.cf_owner_check(p_pw text) returns boolean
language sql security definer set search_path = public as $$ select public._cf_owner_ok(p_pw) $$;

create or replace function public.cf_owner_lookup(p_pw text, p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  select id, pro into r from licenses where id = upper(trim(p_id));
  if not found then return json_build_object('exists', false, 'pro', false); end if;
  return json_build_object('exists', true, 'pro', r.pro);
end $$;

create or replace function public.cf_owner_suggest(p_pw text, p_q text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  return coalesce((select json_agg(x) from (
    select id, pro from licenses where id ilike '%' || replace(upper(trim(p_q)), '-', '%') || '%' order by created_at desc limit 8) x), '[]'::json);
end $$;

create or replace function public.cf_owner_set(p_pw text, p_id text, p_pro boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  insert into licenses(id, pro, updated_at) values (upper(trim(p_id)), p_pro, now())
    on conflict (id) do update set pro = excluded.pro, updated_at = now();
  return true;
end $$;

grant execute on function public.cf_get_pro(text), public.cf_register(text), public.cf_owner_check(text),
  public.cf_owner_lookup(text, text), public.cf_owner_suggest(text, text), public.cf_owner_set(text, text, boolean) to anon;

-- >>> set YOUR owner password here (only a hash is stored) <<<
insert into public.owner_secret(id, pw_hash) values (1, crypt('YOUR_OWNER_PASSWORD', gen_salt('bf')))
  on conflict (id) do update set pw_hash = excluded.pw_hash;
