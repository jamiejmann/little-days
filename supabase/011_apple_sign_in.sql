-- 011: Sign in with Apple support (additive).
-- Stores the Apple refresh token so account deletion can revoke it with Apple
-- (App Store guideline 5.1.1 / Sign in with Apple token revocation).
--
-- DO NOT paste Apple keys into this file. The apple-auth Edge Function reads
-- APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY from
-- Supabase Edge Function secrets (set in the dashboard or a secure form).
--
-- Apply this in the Supabase SQL editor when you are ready. Do not run it
-- against a copy of real family data for testing.

create table if not exists private.apple_refresh_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table private.apple_refresh_tokens enable row level security;
revoke all on table private.apple_refresh_tokens from public, anon, authenticated;

create or replace function private.upsert_apple_refresh_token(p_user uuid, p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_token is null or length(p_token) < 8 then raise exception 'invalid'; end if;
  insert into private.apple_refresh_tokens(user_id, refresh_token, updated_at)
  values (p_user, p_token, now())
  on conflict (user_id) do update set refresh_token = excluded.refresh_token, updated_at = now();
end $$;

create or replace function private.get_apple_refresh_token(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select refresh_token from private.apple_refresh_tokens where user_id = p_user
$$;

create or replace function private.delete_apple_refresh_token(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from private.apple_refresh_tokens where user_id = p_user
$$;

-- Public wrappers for the Edge Function (service role only — never granted to the app).
create or replace function public.upsert_apple_refresh_token(p_user uuid, p_token text) returns void
language sql security definer set search_path = '' as $$
  select private.upsert_apple_refresh_token(p_user, p_token)
$$;
create or replace function public.get_apple_refresh_token(p_user uuid) returns text
language sql security definer set search_path = '' as $$
  select private.get_apple_refresh_token(p_user)
$$;
create or replace function public.delete_apple_refresh_token(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  select private.delete_apple_refresh_token(p_user)
$$;

revoke all on function private.upsert_apple_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function private.get_apple_refresh_token(uuid) from public, anon, authenticated;
revoke all on function private.delete_apple_refresh_token(uuid) from public, anon, authenticated;
revoke all on function public.upsert_apple_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function public.get_apple_refresh_token(uuid) from public, anon, authenticated;
revoke all on function public.delete_apple_refresh_token(uuid) from public, anon, authenticated;
grant execute on function public.upsert_apple_refresh_token(uuid, text) to service_role;
grant execute on function public.get_apple_refresh_token(uuid) to service_role;
grant execute on function public.delete_apple_refresh_token(uuid) to service_role;

-- Recreate delete_my_account so it also drops any stored Apple token.
-- Behavior is otherwise unchanged from 007.
create or replace function private.delete_my_account(p_confirm text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r record;
  heir uuid;
  heir_name text;
  done jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_confirm is distinct from 'DELETE' then raise exception 'Type DELETE to confirm'; end if;
  perform set_config('littledays.deleting_user', uid::text, true);

  for r in select b.id, b.name, m.role from public.baby_members m join public.babies b on b.id = m.baby_id
           where m.user_id = uid order by b.created_at for update of b loop
    heir := private.baby_heir(r.id, uid);
    if heir is null then
      delete from public.babies where id = r.id;
      done := done || jsonb_build_object('baby', r.name, 'action', 'deleted');
    else
      select coalesce(display_name, 'Caregiver') into heir_name from public.profiles where id = heir;
      if r.role = 'owner' and not exists (select 1 from public.baby_members o where o.baby_id = r.id and o.user_id <> uid and o.role = 'owner') then
        update public.baby_members set role = 'owner' where baby_id = r.id and user_id = heir;
        done := done || jsonb_build_object('baby', r.name, 'action', 'transferred', 'to', heir_name);
      else
        done := done || jsonb_build_object('baby', r.name, 'action', 'left');
      end if;
      update public.babies set created_by = heir where id = r.id and created_by = uid;
      delete from public.baby_members where baby_id = r.id and user_id = uid;
    end if;
  end loop;

  for r in select b.id from public.babies b where b.created_by = uid for update loop
    heir := private.baby_heir(r.id, uid);
    if heir is null then delete from public.babies where id = r.id;
    else update public.babies set created_by = heir where id = r.id; end if;
  end loop;

  update public.entries set logged_by = null where logged_by = uid;
  update public.growth  set logged_by = null where logged_by = uid;
  delete from public.invites where created_by = uid;
  delete from public.push_subscriptions where user_id = uid;
  delete from public.device_tokens where user_id = uid;
  delete from private.apple_refresh_tokens where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
  return done;
end $$;
