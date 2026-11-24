-- App Review demo family (FAKE SAMPLE DATA ONLY).
--
-- What this is:
--   A script you can run in the Supabase SQL editor AFTER you create a demo
--   login yourself in the app (email + password). It adds one sample baby,
--   a few days of fake feeds, diapers, sleep, pumping, medicine and growth,
--   and an invite code the reviewer can see on the Family screen.
--
-- What this is not:
--   It does not create the login. You do that in the app (or App Store Connect
--   will not have a password you chose).
--   It must NOT be run against real families' data. Do not point it at a
--   production backup that has real parents in it.
--
-- How to use (when you are ready; not now unless you choose to):
--   1. In the Babyway app, create an account with the email and password you
--      will type into App Store Connect (App Review Information). Confirm the
--      email if asked.
--   2. Open Supabase → SQL → New query.
--   3. Paste this file. Replace the email on the line marked CHANGE ME with
--      that demo account's exact email. Leave the rest as it is.
--   4. Run the script. It will refuse to run if that email has no account,
--      if that account is already on a baby, or if a baby named
--      "Olive (review sample)" already exists for them.
--   5. Put the same email and password only in App Store Connect, not in chat.
--   6. The Family screen will show invite code REVIEW. It lasts 1 year; you
--      can run the UPDATE at the bottom to refresh it.
--
-- This script does not read or print anyone else's data. It looks up only the
-- email you type in.

begin;

do $$
declare
  demo_email text := 'REVIEWER_DEMO_EMAIL@example.com'; -- CHANGE ME
  uid uuid;
  bid uuid;
  t0 timestamptz;
begin
  if demo_email is null or demo_email = 'REVIEWER_DEMO_EMAIL@example.com' or position('@' in demo_email) = 0 then
    raise exception 'Set demo_email to the demo account you created before running this script.';
  end if;

  select id into uid from auth.users where lower(email) = lower(demo_email);
  if uid is null then
    raise exception 'No account exists for that email. Create the demo login in the app first, then run this again.';
  end if;

  if exists (select 1 from public.baby_members m where m.user_id = uid) then
    raise exception 'That account is already on a baby. Use a fresh demo login, or remove it first.';
  end if;

  if exists (select 1 from public.babies b where b.created_by = uid and b.name = 'Olive (review sample)') then
    raise exception 'A review sample baby already exists for this account. Not adding another.';
  end if;

  update public.profiles
    set display_name = 'Alex (demo)'
    where id = uid and display_name is not distinct from split_part(demo_email, '@', 1);

  t0 := date_trunc('hour', now() - interval '6 hours');

  insert into public.babies (
    name, birthdate, birth_time, emoji, created_by, sex, doctor_notes,
    day_start, feed_alarm_enabled, feed_interval_min, feed_alarm_night, tz
  ) values (
    'Olive (review sample)',
    (current_date - 42),
    '15:12',
    '🐣',
    uid,
    'female',
    'Sample questions: is 3 hours between feeds typical? Any concern about the last two dirty diapers being a bit seedy?',
    'midnight',
    true,
    180,
    true,
    'America/Detroit'
  ) returning id into bid;

  insert into public.baby_members (baby_id, user_id, role) values (bid, uid, 'owner');

  -- Invite code REVIEW is only set because this runs in the SQL editor (auth.uid() is null),
  -- so the app-user trigger that rewrites codes does not fire. Do not insert codes from the app.
  insert into public.invites (code, baby_id, created_by, expires_at)
  values ('REVIEW', bid, uid, now() + interval '1 year');

  -- Fake sample log, all times in the past, clearly a demo baby.
  insert into public.entries (baby_id, type, subtype, start_at, end_at, amount, unit, details, logged_by) values
    (bid, 'feed',     'breast', t0 - interval '11 hours', t0 - interval '10 hours 42 minutes', null, null, jsonb_build_object('side','both','note','sample data'), uid),
    (bid, 'diaper',   'both',   t0 - interval '10 hours 30 minutes', t0 - interval '10 hours 30 minutes', null, null, jsonb_build_object('color','yellow','texture','seedy','amount','medium'), uid),
    (bid, 'sleep',    null,     t0 - interval '10 hours 15 minutes', t0 - interval '8 hours 20 minutes', null, null, '{}'::jsonb, uid),
    (bid, 'feed',     'bottle', t0 - interval '8 hours', t0 - interval '8 hours', 3.0, 'oz', jsonb_build_object('milk','pumped'), uid),
    (bid, 'pump',     null,     t0 - interval '8 hours 20 minutes', t0 - interval '8 hours 5 minutes', 3.0, 'oz', jsonb_build_object('pside','both'), uid),
    (bid, 'diaper',   'pee',    t0 - interval '7 hours 30 minutes', t0 - interval '7 hours 30 minutes', null, null, '{}'::jsonb, uid),
    (bid, 'sleep',    null,     t0 - interval '7 hours', t0 - interval '5 hours 10 minutes', null, null, '{}'::jsonb, uid),
    (bid, 'feed',     'breast', t0 - interval '5 hours', t0 - interval '4 hours 38 minutes', null, null, jsonb_build_object('side','L'), uid),
    (bid, 'medicine', null,     t0 - interval '4 hours 30 minutes', t0 - interval '4 hours 30 minutes', null, null, jsonb_build_object('name','Vitamin D','dose','1 drop'), uid),
    (bid, 'diaper',   'poop',   t0 - interval '4 hours 15 minutes', t0 - interval '4 hours 15 minutes', null, null, jsonb_build_object('color','yellow','texture','seedy','amount','small'), uid),
    (bid, 'feed',     'bottle', t0 - interval '2 hours', t0 - interval '2 hours', 2.5, 'oz', jsonb_build_object('milk','formula'), uid),
    (bid, 'diaper',   'pee',    t0 - interval '90 minutes', t0 - interval '90 minutes', null, null, '{}'::jsonb, uid);

  insert into public.growth (baby_id, measured_on, weight_g, length_cm, head_cm, logged_by) values
    (bid, current_date - 42, 3400, 50.0, 34.5, uid),
    (bid, current_date - 28, 3900, 52.0, 35.5, uid),
    (bid, current_date - 7,  4500, 54.5, 37.0, uid);

  raise notice 'Demo baby "Olive (review sample)" is ready. Invite code: REVIEW. Put the demo email and password only in App Store Connect.';
end $$;

commit;
