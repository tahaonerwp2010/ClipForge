-- ClipForge licenses (v2: trial + monthly / yearly / forever). Run this in Supabase: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again and it keeps every existing row. Old "pro = true" PCs become Pro forever.
-- BEFORE running: change YOUR_OWNER_PASSWORD (last lines) to the password you want for the owner panel.
create extension if not exists pgcrypto;

create table if not exists public.licenses (
  id          text primary key,                 -- the PC id, e.g. CF-1A2B-3C4D-5E6F-7A8B
  pro         boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.licenses add column if not exists forever     boolean not null default false;
alter table public.licenses add column if not exists pro_until   timestamptz;     -- paid access runs until this moment (monthly / yearly)
alter table public.licenses add column if not exists trial_start timestamptz;     -- set once, on the first start after the trial system is switched on
update public.licenses set forever = true where pro = true and forever = false and pro_until is null;   -- old owner-set Pro = forever

create table if not exists public.owner_secret (
  id      int primary key default 1,
  pw_hash text not null
);
alter table public.licenses     enable row level security;
alter table public.owner_secret enable row level security;

create or replace function public._cf_owner_ok(p_pw text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare ok boolean;
begin
  select exists(select 1 from owner_secret where pw_hash = crypt(coalesce(p_pw, ''), pw_hash)) into ok;
  if not ok then perform pg_sleep(1); end if;
  return ok;
end $$;
revoke all on function public._cf_owner_ok(text) from public, anon, authenticated;

-- one place that turns a row into what the app / owner panel needs (all times from the SERVER clock)
create or replace function public._cf_json(r public.licenses) returns json
language plpgsql security definer set search_path = public as $$
declare active boolean; trial_end timestamptz;
begin
  active := r.forever or (r.pro_until is not null and r.pro_until > now());
  trial_end := case when r.trial_start is null then null else r.trial_start + interval '7 days' end;
  return json_build_object(
    'exists', true, 'pro', active, 'forever', r.forever, 'proUntil', r.pro_until,
    'proDaysLeft', case when active and not r.forever then greatest(0, ceil(extract(epoch from (r.pro_until - now())) / 86400)) else null end,
    'trialStart', r.trial_start, 'trialEnd', trial_end,
    'trialActive', (not active) and trial_end is not null and trial_end > now(),
    'trialDaysLeft', case when (not active) and trial_end is not null and trial_end > now() then ceil(extract(epoch from (trial_end - now())) / 86400) else 0 end,
    'now', now());
end $$;
revoke all on function public._cf_json(public.licenses) from public, anon, authenticated;

create or replace function public.cf_register(p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_id !~ '^CF-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then raise exception 'bad id'; end if;
  insert into licenses(id, pro) values (p_id, false) on conflict (id) do nothing;
end $$;

-- the app asks: what does this PC get? p_trial = the trial system is switched on in this app build.
-- The first time a PC asks with p_trial = true its 7 days start (server time). Never restarts.
create or replace function public.cf_status(p_id text, p_trial boolean) returns json
language plpgsql security definer set search_path = public as $$
declare r public.licenses;
begin
  if p_id !~ '^CF-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' then raise exception 'bad id'; end if;
  insert into licenses(id, pro) values (p_id, false) on conflict (id) do nothing;
  if p_trial then update licenses set trial_start = now() where id = p_id and trial_start is null; end if;
  select * into r from licenses where id = p_id;
  return public._cf_json(r);
end $$;

-- old app versions still call this one
create or replace function public.cf_get_pro(p_id text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select forever or (pro_until is not null and pro_until > now()) from licenses where id = p_id), false)
$$;

create or replace function public.cf_owner_check(p_pw text) returns boolean
language sql security definer set search_path = public as $$ select public._cf_owner_ok(p_pw) $$;

create or replace function public.cf_owner_lookup(p_pw text, p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare r public.licenses;
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  select * into r from licenses where id = upper(trim(p_id));
  if not found then return json_build_object('exists', false, 'pro', false); end if;
  return public._cf_json(r);
end $$;

create or replace function public.cf_owner_suggest(p_pw text, p_q text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  return coalesce((select json_agg(x) from (
    select id, (forever or (pro_until is not null and pro_until > now())) as pro from licenses
    where id ilike '%' || replace(upper(trim(p_q)), '-', '%') || '%' order by created_at desc limit 8) x), '[]'::json);
end $$;

-- give Pro: plan = 'month' (30 days), 'year' (365 days) or 'forever'. Buying ends the trial (it never stacks with the paid time).
-- If the PC is still inside paid time, month / year are added after the current end.
create or replace function public.cf_owner_grant(p_pw text, p_id text, p_plan text) returns json
language plpgsql security definer set search_path = public as $$
declare r public.licenses; base timestamptz; id_ text := upper(trim(p_id));
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  if p_plan not in ('month', 'year', 'forever') then raise exception 'bad plan'; end if;
  insert into licenses(id, pro) values (id_, false) on conflict (id) do nothing;
  select * into r from licenses where id = id_;
  base := case when r.pro_until is not null and r.pro_until > now() then r.pro_until else now() end;
  if p_plan = 'forever' then
    update licenses set forever = true, pro_until = null, pro = true, trial_start = now() - interval '8 days', updated_at = now() where id = id_;
  elsif p_plan = 'month' then
    update licenses set pro_until = base + interval '30 days', pro = true, trial_start = now() - interval '8 days', updated_at = now() where id = id_;
  else
    update licenses set pro_until = base + interval '365 days', pro = true, trial_start = now() - interval '8 days', updated_at = now() where id = id_;
  end if;
  select * into r from licenses where id = id_;
  return public._cf_json(r);
end $$;

-- take Pro away (the trial stays used up)
create or replace function public.cf_owner_remove(p_pw text, p_id text) returns json
language plpgsql security definer set search_path = public as $$
declare r public.licenses; id_ text := upper(trim(p_id));
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  update licenses set forever = false, pro_until = null, pro = false, trial_start = now() - interval '8 days', updated_at = now() where id = id_;
  select * into r from licenses where id = id_;
  if not found then return json_build_object('exists', false, 'pro', false); end if;
  return public._cf_json(r);
end $$;

-- the old on/off function, kept so old app versions do not break (true = forever)
create or replace function public.cf_owner_set(p_pw text, p_id text, p_pro boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public._cf_owner_ok(p_pw) then raise exception 'denied'; end if;
  if p_pro then perform public.cf_owner_grant(p_pw, p_id, 'forever'); else perform public.cf_owner_remove(p_pw, p_id); end if;
  return true;
end $$;

grant execute on function public.cf_get_pro(text), public.cf_register(text), public.cf_status(text, boolean), public.cf_owner_check(text),
  public.cf_owner_lookup(text, text), public.cf_owner_suggest(text, text), public.cf_owner_grant(text, text, text),
  public.cf_owner_remove(text, text), public.cf_owner_set(text, text, boolean) to anon;

-- >>> set YOUR owner password here (only a hash is stored). When you run this script again later, the password already saved is kept. <<<
insert into public.owner_secret(id, pw_hash) values (1, crypt('YOUR_OWNER_PASSWORD', gen_salt('bf')))
  on conflict (id) do nothing;
