-- Little Days migration 002: baby birth time + shared "day starts at" setting (non-destructive)
alter table public.babies add column if not exists birth_time time;
alter table public.babies add column if not exists day_start text not null default 'midnight';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'babies_day_start_check') then
    alter table public.babies add constraint babies_day_start_check check (day_start in ('midnight','birth'));
  end if;
end $$;

-- create_baby gains an optional birth time (old 3-argument calls still work through the defaults)
drop function if exists public.create_baby(text, date, text);
drop function if exists private.create_baby(text, date, text);
create or replace function private.create_baby(p_name text, p_birthdate date, p_emoji text, p_birth_time time default null)
returns public.babies language plpgsql security definer set search_path = '' as $$
declare r public.babies;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.babies(name, birthdate, emoji, created_by, birth_time)
    values (p_name, p_birthdate, coalesce(nullif(p_emoji,''),'🐣'), auth.uid(), p_birth_time) returning * into r;
  insert into public.baby_members(baby_id, user_id, role) values (r.id, auth.uid(), 'owner');
  return r;
end $$;
create or replace function public.create_baby(p_name text, p_birthdate date default null, p_emoji text default '🐣', p_birth_time time default null)
returns public.babies language sql security invoker set search_path = '' as $$
  select * from private.create_baby(p_name, p_birthdate, p_emoji, p_birth_time)
$$;
revoke execute on function private.create_baby(text, date, text, time) from public, anon;
grant execute on function private.create_baby(text, date, text, time) to authenticated;
revoke execute on function public.create_baby(text, date, text, time) from public, anon;
grant execute on function public.create_baby(text, date, text, time) to authenticated;
