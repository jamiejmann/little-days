-- Little Days schema: shared baby profiles with per-person logins
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- PROFILES -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Parent' check (char_length(display_name) between 1 and 40),
  color text not null default '#FFD9C4' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

-- BABIES ---------------------------------------------------------------
create table public.babies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  birthdate date,
  emoji text not null default '🐣' check (char_length(emoji) <= 8),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.babies(created_by);

create table public.baby_members (
  baby_id uuid not null references public.babies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'caregiver' check (role in ('owner','caregiver')),
  joined_at timestamptz not null default now(),
  primary key (baby_id, user_id)
);
create index on public.baby_members(user_id);

create or replace function private.gen_code() returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random()*32)::int, 1), '')
  from generate_series(1,6)
$$;

create table public.invites (
  code text primary key default private.gen_code() check (code ~ '^[A-Z0-9]{6}$'),
  baby_id uuid not null references public.babies(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index on public.invites(baby_id);
create index on public.invites(created_by);

-- ENTRIES (a running timer = entry with end_at null) --------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  type text not null check (type in ('feed','diaper','sleep')),
  subtype text check (subtype in ('breast','bottle','pee','poop','both') or subtype is null),
  start_at timestamptz not null default now(),
  end_at timestamptz check (end_at is null or end_at >= start_at),
  amount numeric(6,1),
  unit text check (unit in ('oz','ml') or unit is null),
  details jsonb not null default '{}'::jsonb,
  logged_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.entries(baby_id, start_at desc);
create index on public.entries(logged_by);

-- HELPERS (security definer, private schema) ---------------------------
create or replace function private.is_member(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.baby_members m where m.baby_id = b and m.user_id = (select auth.uid()))
$$;
create or replace function private.is_owner(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.baby_members m where m.baby_id = b and m.user_id = (select auth.uid()) and m.role = 'owner')
$$;
create or replace function private.shares_baby(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.baby_members a join public.baby_members b2 on a.baby_id = b2.baby_id
                where a.user_id = (select auth.uid()) and b2.user_id = other)
$$;

create or replace function private.create_baby(p_name text, p_birthdate date, p_emoji text) returns public.babies
language plpgsql security definer set search_path = '' as $$
declare r public.babies;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.babies(name, birthdate, emoji, created_by)
    values (p_name, p_birthdate, coalesce(nullif(p_emoji,''),'🐣'), auth.uid()) returning * into r;
  insert into public.baby_members(baby_id, user_id, role) values (r.id, auth.uid(), 'owner');
  return r;
end $$;

create or replace function private.join_baby_with_code(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.invites;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into inv from public.invites where code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if inv.code is null then raise exception 'Invite code not found'; end if;
  if inv.expires_at < now() then raise exception 'Invite code has expired'; end if;
  insert into public.baby_members(baby_id, user_id, role) values (inv.baby_id, auth.uid(), 'caregiver')
    on conflict (baby_id, user_id) do nothing;
  return inv.baby_id;
end $$;

-- public wrappers (security invoker) so the app can call them via RPC
create or replace function public.create_baby(p_name text, p_birthdate date default null, p_emoji text default '🐣')
returns public.babies language sql security invoker set search_path = '' as $$
  select * from private.create_baby(p_name, p_birthdate, p_emoji)
$$;
create or replace function public.join_baby_with_code(code text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.join_baby_with_code(code)
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function public.create_baby(text, date, text) from public, anon;
revoke execute on function public.join_baby_with_code(text) from public, anon;
grant execute on function public.create_baby(text, date, text) to authenticated;
grant execute on function public.join_baby_with_code(text) to authenticated;

-- auto-create profile on sign up (display name is cosmetic only; random pastel color)
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, color)
  values (new.id,
          left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1), 'Parent'), 40),
          (array['#FFD9C4','#BFDDF5','#C6EBDD','#DCD3F5','#FFF0BF','#F8D3E3'])[1 + floor(random()*6)::int])
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); new.logged_by = old.logged_by; new.baby_id = old.baby_id; return new; end $$;
create trigger entries_touch before update on public.entries for each row execute function private.touch_updated_at();

-- RLS ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.babies enable row level security;
alter table public.baby_members enable row level security;
alter table public.invites enable row level security;
alter table public.entries enable row level security;

create policy "see self and co-caregivers" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_baby(id));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members read baby" on public.babies for select to authenticated using (private.is_member(id));
create policy "members edit baby" on public.babies for update to authenticated using (private.is_member(id)) with check (private.is_member(id));
create policy "owner deletes baby" on public.babies for delete to authenticated using (private.is_owner(id));

create policy "members see members" on public.baby_members for select to authenticated using (private.is_member(baby_id));
create policy "owner removes others, anyone leaves" on public.baby_members for delete to authenticated
  using ((private.is_owner(baby_id) and user_id <> (select auth.uid())) or (user_id = (select auth.uid()) and role <> 'owner'));
create policy "owner changes roles" on public.baby_members for update to authenticated
  using (private.is_owner(baby_id) and user_id <> (select auth.uid())) with check (private.is_owner(baby_id));

create policy "members see invites" on public.invites for select to authenticated using (private.is_member(baby_id));
create policy "members create invites" on public.invites for insert to authenticated
  with check (private.is_member(baby_id) and created_by = (select auth.uid()));
create policy "members delete invites" on public.invites for delete to authenticated using (private.is_member(baby_id));

create policy "members read entries" on public.entries for select to authenticated using (private.is_member(baby_id));
create policy "members add entries as themselves" on public.entries for insert to authenticated
  with check (private.is_member(baby_id) and logged_by = (select auth.uid()));
create policy "members edit entries" on public.entries for update to authenticated
  using (private.is_member(baby_id)) with check (private.is_member(baby_id));
create policy "members delete entries" on public.entries for delete to authenticated using (private.is_member(baby_id));

-- table grants: nothing for anon
revoke all on public.profiles, public.babies, public.baby_members, public.invites, public.entries from anon;

-- REALTIME -------------------------------------------------------------
alter publication supabase_realtime add table public.entries, public.baby_members, public.babies;
