-- Little Days migration 003: feeding alarm + Web Push subscriptions (non-destructive)
alter table public.babies add column if not exists feed_alarm_enabled boolean not null default false;
alter table public.babies add column if not exists feed_interval_min integer not null default 180;
alter table public.babies add column if not exists feed_alarm_night boolean not null default true;
alter table public.babies add column if not exists tz text not null default 'UTC';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='babies_feed_interval_check') then
    alter table public.babies add constraint babies_feed_interval_check check (feed_interval_min between 30 and 720);
  end if;
  if not exists (select 1 from pg_constraint where conname='babies_tz_check') then
    alter table public.babies add constraint babies_tz_check check (char_length(tz) between 1 and 64);
  end if;
end $$;

-- one row per browser/phone that turned on alerts; each person only sees their own
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
create policy "own subscriptions: read" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "own subscriptions: add" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own subscriptions: change" on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own subscriptions: remove" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;

-- alarm bookkeeping (private, server only)
create table if not exists private.feed_alarm_log (
  baby_id uuid primary key references public.babies(id) on delete cascade,
  last_feed_at timestamptz,
  sent_count integer not null default 0,
  last_sent_at timestamptz
);
grant usage on schema private to service_role;
grant select, insert, update, delete on private.feed_alarm_log to service_role;

-- finds overdue babies, records that an alert went out (one per overdue period + one follow-up after 15 min)
create or replace function private.feed_alarm_claim()
returns table(baby_id uuid, baby_name text, kind text, overdue_min integer, last_feed_at timestamptz, endpoint text, p256dh text, auth text)
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
      update private.feed_alarm_log l set sent_count = 2 where l.baby_id = b.id;  -- quiet night: skip this period
      continue;
    end if;
    k := case when st.sent_count = 0 then 'due' else 'followup' end;
    update private.feed_alarm_log l set sent_count = st.sent_count + 1, last_sent_at = now() where l.baby_id = b.id;
    return query
      select b.id, b.name, k, floor(extract(epoch from now() - due) / 60)::int, lf, s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s join public.baby_members m on m.user_id = s.user_id
      where m.baby_id = b.id;
  end loop;
end $$;

-- push keys + cron secret live in Supabase Vault (never in the repo or the web page)
create or replace function private.feed_alarm_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb) from vault.decrypted_secrets
  where name in ('vapid_public_key','vapid_private_key','vapid_subject','feed_alarm_cron_secret')
$$;

-- thin wrappers the Edge Function can call with the service role only
create or replace function public.feed_alarm_claim()
returns table(baby_id uuid, baby_name text, kind text, overdue_min integer, last_feed_at timestamptz, endpoint text, p256dh text, auth text)
language sql security invoker set search_path = '' as $$ select * from private.feed_alarm_claim() $$;
create or replace function public.feed_alarm_config() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.feed_alarm_config() $$;

revoke execute on function private.feed_alarm_claim() from public, anon, authenticated;
revoke execute on function private.feed_alarm_config() from public, anon, authenticated;
revoke execute on function public.feed_alarm_claim() from public, anon, authenticated;
revoke execute on function public.feed_alarm_config() from public, anon, authenticated;
grant execute on function private.feed_alarm_claim() to service_role;
grant execute on function private.feed_alarm_config() to service_role;
grant execute on function public.feed_alarm_claim() to service_role;
grant execute on function public.feed_alarm_config() to service_role;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
