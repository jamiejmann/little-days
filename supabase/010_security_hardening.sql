-- Little Days migration 010: security hardening before App Store launch (tightening only; no existing rows changed).
-- (009 is reserved for the todays-moments branch: 009_moments.sql. 010 does not depend on it.)
--
-- 1. Invite codes are made with a cryptographically secure random source (gen_random_uuid), not random().
-- 2. New invites always get a server-made code and a 7-day expiry (a client can no longer pick "AAAAAA" or a 2099 expiry).
-- 3. Joining with a code is throttled: after 10 wrong codes in 15 minutes an account must wait.
--    Wrong/expired codes now return NULL instead of raising, so the failed attempt is remembered
--    (a raised error would roll the attempt record back). The app shows a friendly message for NULL.
-- 4. Growth measurements keep their original author and baby on edit (same rule entries already had).
-- 5. A baby's created_by can't be changed by app users (only by the delete-my-account function).
-- 6. launch_signups: real email shape required, and a global cap of 60 sign-ups per 10 minutes against bot spam.

-- 1 ---------------------------------------------------------------------------------------------
create or replace function private.gen_code() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) r, generate_series(0, 5) as i
$$;

-- 2 ---------------------------------------------------------------------------------------------
create or replace function private.invites_server_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null then           -- app users; service role / SQL editor keep full control
    new.code := private.gen_code();
    new.expires_at := now() + interval '7 days';
    new.created_by := (select auth.uid());
    new.created_at := now();
  end if;
  return new;
end $$;
drop trigger if exists invites_server_defaults on public.invites;
create trigger invites_server_defaults before insert on public.invites for each row execute function private.invites_server_defaults();

-- 3 ---------------------------------------------------------------------------------------------
create table if not exists private.invite_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists invite_attempts_user_at_idx on private.invite_attempts(user_id, at desc);
alter table private.invite_attempts enable row level security;   -- not exposed; only the definer function below touches it
revoke all on private.invite_attempts from public, anon, authenticated;

create or replace function private.join_baby_with_code(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invites; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from private.invite_attempts where user_id = uid and at < now() - interval '1 day';
  if (select count(*) from private.invite_attempts where user_id = uid and at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many tries. Please wait 15 minutes and try again.';
  end if;
  select * into inv from public.invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if inv.code is null or inv.expires_at < now() then
    insert into private.invite_attempts(user_id) values (uid);
    return null;                                     -- app: "That code didn't work"
  end if;
  insert into public.baby_members(baby_id, user_id, role) values (inv.baby_id, uid, 'caregiver')
    on conflict (baby_id, user_id) do nothing;
  return inv.baby_id;
end $$;
revoke execute on function private.join_baby_with_code(text) from public, anon;
grant execute on function private.join_baby_with_code(text) to authenticated;

-- 4 ---------------------------------------------------------------------------------------------
-- reuse entries' trigger: keeps logged_by + baby_id, bumps updated_at; lets delete_my_account clear the author
drop trigger if exists growth_touch on public.growth;
create trigger growth_touch before update on public.growth for each row execute function private.touch_updated_at();

-- 5 ---------------------------------------------------------------------------------------------
create or replace function private.babies_keep_creator() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by
     and (select auth.uid()) is not null
     and coalesce(current_setting('littledays.deleting_user', true), '') <> old.created_by::text then
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
drop trigger if exists babies_keep_creator on public.babies;
create trigger babies_keep_creator before update on public.babies for each row execute function private.babies_keep_creator();

-- 6 ---------------------------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'launch_signups_email_shape') then
    alter table public.launch_signups add constraint launch_signups_email_shape
      check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid;   -- new rows only
  end if;
end $$;

create or replace function private.launch_signups_throttle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.launch_signups where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'Too many sign-ups right now. Please try again in a few minutes.';
  end if;
  new.created_at := now();
  return new;
end $$;
revoke execute on function private.launch_signups_throttle() from public, anon, authenticated;
drop trigger if exists launch_signups_throttle on public.launch_signups;
create trigger launch_signups_throttle before insert on public.launch_signups for each row execute function private.launch_signups_throttle();
