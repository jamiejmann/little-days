-- 006: native iOS push (APNs) device tokens + a per-baby alarm claim. Additive only:
-- a new table, new functions. Existing tables, rows and the old feed_alarm_claim() are untouched.
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios')),
  token text not null unique check (token ~ '^[0-9a-fA-F]{32,200}$'),
  environment text not null default 'production' check (environment in ('production','sandbox')),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);
alter table public.device_tokens enable row level security;
drop policy if exists "own device tokens: read" on public.device_tokens;
drop policy if exists "own device tokens: remove" on public.device_tokens;
create policy "own device tokens: read" on public.device_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy "own device tokens: remove" on public.device_tokens for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.device_tokens from anon;
grant select, delete on public.device_tokens to authenticated;

-- A phone can change hands between accounts (sign out / sign in), so registering moves the token to the caller.
create or replace function private.register_device_token(p_token text, p_environment text default 'production', p_app_version text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.device_tokens (user_id, token, environment, app_version)
  values (auth.uid(), lower(p_token), coalesce(p_environment, 'production'), p_app_version)
  on conflict (token) do update set user_id = auth.uid(), environment = excluded.environment, app_version = excluded.app_version, updated_at = now();
end $$;
create or replace function private.unregister_device_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.device_tokens where token = lower(p_token) and user_id = auth.uid();
$$;
create or replace function public.register_device_token(p_token text, p_environment text default 'production', p_app_version text default null)
returns void language sql security invoker set search_path = '' as $$ select private.register_device_token(p_token, p_environment, p_app_version) $$;
create or replace function public.unregister_device_token(p_token text)
returns void language sql security invoker set search_path = '' as $$ select private.unregister_device_token(p_token) $$;
revoke execute on function private.register_device_token(text, text, text) from public, anon;
revoke execute on function private.unregister_device_token(text) from public, anon;
revoke execute on function public.register_device_token(text, text, text) from public, anon;
revoke execute on function public.unregister_device_token(text) from public, anon;
grant execute on function private.register_device_token(text, text, text) to authenticated;
grant execute on function private.unregister_device_token(text) to authenticated;
grant execute on function public.register_device_token(text, text, text) to authenticated;
grant execute on function public.unregister_device_token(text) to authenticated;

-- Same rules as feed_alarm_claim(), but one row per claimed baby; the Edge Function then looks up
-- every member's web subscriptions and iOS device tokens. (The old function stays for older deployments.)
create or replace function private.feed_alarm_claim_babies()
returns table(baby_id uuid, baby_name text, kind text, overdue_min integer, last_feed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare b record; lf timestamptz; st private.feed_alarm_log; due timestamptz; hr int; k text;
begin
  for b in select * from public.babies where feed_alarm_enabled loop
    if exists (select 1 from public.entries e where e.baby_id = b.id and e.type = 'feed' and e.end_at is null) then continue; end if;
    select max(e.start_at) into lf from public.entries e where e.baby_id = b.id and e.type = 'feed';
    if lf is null then continue; end if;
    due := lf + make_interval(mins => b.feed_interval_min);
    if now() < due or now() > due + interval '6 hours' then continue; end if;
    select * into st from private.feed_alarm_log l where l.baby_id = b.id for update;
    if st.baby_id is null or st.last_feed_at is distinct from lf then
      insert into private.feed_alarm_log as l (baby_id, last_feed_at, sent_count, last_sent_at) values (b.id, lf, 0, null)
        on conflict on constraint feed_alarm_log_pkey do update set last_feed_at = excluded.last_feed_at, sent_count = 0, last_sent_at = null;
      st.sent_count := 0;
    end if;
    if st.sent_count >= 2 then continue; end if;
    if st.sent_count = 1 and now() < due + interval '15 minutes' then continue; end if;
    hr := extract(hour from (now() at time zone b.tz))::int;
    if (hr >= 22 or hr < 6) and not b.feed_alarm_night then
      update private.feed_alarm_log l set sent_count = 2 where l.baby_id = b.id;
      continue;
    end if;
    k := case when st.sent_count = 0 then 'due' else 'followup' end;
    update private.feed_alarm_log l set sent_count = st.sent_count + 1, last_sent_at = now() where l.baby_id = b.id;
    baby_id := b.id; baby_name := b.name; kind := k; overdue_min := floor(extract(epoch from now() - due) / 60)::int; last_feed_at := lf;
    return next;
  end loop;
end $$;
create or replace function public.feed_alarm_claim_babies()
returns table(baby_id uuid, baby_name text, kind text, overdue_min integer, last_feed_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.feed_alarm_claim_babies() $$;
revoke execute on function private.feed_alarm_claim_babies() from public, anon, authenticated;
revoke execute on function public.feed_alarm_claim_babies() from public, anon, authenticated;
grant execute on function private.feed_alarm_claim_babies() to service_role;
grant execute on function public.feed_alarm_claim_babies() to service_role;
grant select, delete, update on public.device_tokens to service_role;
