-- Babyway migration 012: a small, private error log for the app (beta readiness). NOT DEPLOYED: apply only after Jamie approves.
-- (009 is reserved for todays-moments, 011 is Apple sign-in. 012 does not depend on either.)
--
-- What it stores, and nothing else: the error message (scrubbed on the device, max 300 chars), the app version,
-- the screen name, and a random install ID made on the device (not tied to the account, the baby or the email).
-- No user ID, no baby ID, no entries, no IP address column.
-- Anyone running the app can ADD a row (anon or signed in). No one can read, change or delete rows through the API:
-- only Jamie, in the Supabase dashboard (SQL editor / service role).
-- Rows are deleted automatically after 90 days (pg_cron, daily at 03:17 UTC).
-- A global cap of 300 rows per 10 minutes stops a broken build or a bot from flooding the table.

create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  install_id  uuid not null,
  app_version text not null check (char_length(app_version) between 1 and 40),
  screen      text not null check (char_length(screen) between 1 and 40),
  message     text not null check (char_length(message) between 1 and 300)
);
comment on table public.client_errors is 'Babyway app error log: message, app version, screen and an anonymous install ID only. Insert-only via the API. Auto-deleted after 90 days.';
create index if not exists client_errors_created_at_idx on public.client_errors (created_at);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from public, anon, authenticated;
grant insert (install_id, app_version, screen, message) on public.client_errors to anon, authenticated;

drop policy if exists "anyone can add an error report" on public.client_errors;
create policy "anyone can add an error report" on public.client_errors
  for insert to anon, authenticated with check (true);
-- no select / update / delete policies: the API can't read or change the log

create or replace function private.client_errors_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.client_errors where created_at > now() - interval '10 minutes') >= 300 then
    return null;                      -- over the cap: drop the row quietly (the app never retries)
  end if;
  new.created_at := now();            -- the server sets the time
  return new;
end $$;
revoke execute on function private.client_errors_guard() from public, anon, authenticated;
drop trigger if exists client_errors_guard on public.client_errors;
create trigger client_errors_guard before insert on public.client_errors for each row execute function private.client_errors_guard();

-- 90-day retention
select cron.unschedule('babyway-client-errors-retention') where exists (select 1 from cron.job where jobname = 'babyway-client-errors-retention');
select cron.schedule('babyway-client-errors-retention', '17 3 * * *', $job$
  delete from public.client_errors where created_at < now() - interval '90 days';
$job$);
