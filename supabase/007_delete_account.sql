-- 007: "Delete my account" (App Store guideline 5.1.1(v)).
-- Additive: new functions only, plus a narrowly widened entries trigger. No table, column or existing row is changed by the migration itself.
--
-- What deleting an account does (all in one transaction):
--   * each baby the person belongs to:
--       - no other members  -> the baby and everything under it (entries, growth, invites, alarm state) is deleted
--       - other members     -> they stay; if the person was the only owner, ownership passes to the longest-standing
--                              caregiver (earliest joined_at); babies.created_by is re-pointed so nothing cascades
--   * babies they created but already left -> re-pointed to the earliest remaining owner/member (or deleted if empty)
--   * entries/growth they logged on babies that remain -> kept, author cleared (shown as "Former caregiver")
--   * their memberships, invites, web push subscriptions, iPhone push tokens, profile and the auth account are removed

-- entries_touch keeps logged_by immutable for normal edits. Allow exactly one exception: during account deletion
-- the deleting user's own entries may have their author cleared (the setting is transaction-local and only set by
-- private.delete_my_account; clients cannot set it through the API).
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.logged_by is null and old.logged_by is not null
     and coalesce(current_setting('littledays.deleting_user', true), '') = old.logged_by::text then
    new.updated_at = old.updated_at; new.baby_id = old.baby_id; return new;
  end if;
  new.updated_at = now(); new.logged_by = old.logged_by; new.baby_id = old.baby_id; return new;
end $$;

-- who would inherit a baby if this user left: another owner first, otherwise the longest-standing caregiver
create or replace function private.baby_heir(p_baby uuid, p_leaving uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.baby_members m
  where m.baby_id = p_baby and m.user_id <> p_leaving
  order by (m.role = 'owner') desc, m.joined_at, m.user_id
  limit 1
$$;

-- what will happen, for the confirm screen (only the caller's own babies)
create or replace function private.account_deletion_preview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'baby', b.name,
      'action', case when h.heir is null then 'delete'
                     when m.role = 'owner' and not exists (select 1 from public.baby_members o where o.baby_id = b.id and o.user_id <> uid and o.role = 'owner') then 'transfer'
                     else 'leave' end,
      'to', coalesce(p.display_name, 'Caregiver'),
      'others', (select count(*) from public.baby_members o where o.baby_id = b.id and o.user_id <> uid)
    ) order by b.created_at)
    from public.baby_members m
    join public.babies b on b.id = m.baby_id
    cross join lateral (select private.baby_heir(b.id, uid) as heir) h
    left join public.profiles p on p.id = h.heir
    where m.user_id = uid), '[]'::jsonb);
end $$;

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
      delete from public.babies where id = r.id;   -- cascades entries, growth, invites, members, alarm state
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

  -- babies this user created but had already left: never let them cascade away from the family
  for r in select b.id from public.babies b where b.created_by = uid for update loop
    heir := private.baby_heir(r.id, uid);
    if heir is null then delete from public.babies where id = r.id;
    else update public.babies set created_by = heir where id = r.id; end if;
  end loop;

  update public.entries set logged_by = null where logged_by = uid;   -- kept on shared babies, shown as "Former caregiver"
  update public.growth  set logged_by = null where logged_by = uid;
  delete from public.invites where created_by = uid;
  delete from public.push_subscriptions where user_id = uid;
  delete from public.device_tokens where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;                               -- sessions, identities etc. go with it
  return done;
end $$;

create or replace function public.account_deletion_preview() returns jsonb
language sql security invoker set search_path = '' as $$ select private.account_deletion_preview() $$;
create or replace function public.delete_my_account(p_confirm text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.delete_my_account(p_confirm) $$;

revoke execute on function private.baby_heir(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.account_deletion_preview() from public, anon;
revoke execute on function private.delete_my_account(text) from public, anon;
grant execute on function private.account_deletion_preview() to authenticated;
grant execute on function private.delete_my_account(text) to authenticated;
revoke execute on function public.account_deletion_preview() from public, anon;
revoke execute on function public.delete_my_account(text) from public, anon;
grant execute on function public.account_deletion_preview() to authenticated;
grant execute on function public.delete_my_account(text) to authenticated;
