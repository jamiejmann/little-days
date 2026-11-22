-- 005: growth measurements, optional baby sex (for WHO percentiles), shared doctor notes.
-- Additive only: new nullable/defaulted columns and a new table. Existing rows are not touched.
alter table public.babies add column if not exists sex text;
alter table public.babies add column if not exists doctor_notes text not null default '';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'babies_sex_check') then
    alter table public.babies add constraint babies_sex_check check (sex is null or sex in ('female','male'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'babies_doctor_notes_check') then
    alter table public.babies add constraint babies_doctor_notes_check check (char_length(doctor_notes) <= 4000);
  end if;
end $$;

create table if not exists public.growth (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  measured_on date not null default current_date,
  weight_g numeric(7,1) check (weight_g is null or weight_g between 300 and 40000),
  length_cm numeric(6,2) check (length_cm is null or length_cm between 20 and 130),
  head_cm numeric(6,2) check (head_cm is null or head_cm between 15 and 70),
  logged_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_has_a_value check (weight_g is not null or length_cm is not null or head_cm is not null)
);
create index if not exists growth_baby_measured_idx on public.growth(baby_id, measured_on desc);
create index if not exists growth_logged_by_idx on public.growth(logged_by);

alter table public.growth enable row level security;
drop policy if exists "members read growth" on public.growth;
drop policy if exists "members add growth as themselves" on public.growth;
drop policy if exists "members edit growth" on public.growth;
drop policy if exists "members delete growth" on public.growth;
create policy "members read growth" on public.growth for select to authenticated using (private.is_member(baby_id));
create policy "members add growth as themselves" on public.growth for insert to authenticated
  with check (private.is_member(baby_id) and logged_by = (select auth.uid()));
create policy "members edit growth" on public.growth for update to authenticated
  using (private.is_member(baby_id)) with check (private.is_member(baby_id));
create policy "members delete growth" on public.growth for delete to authenticated using (private.is_member(baby_id));
revoke all on public.growth from anon;
grant select, insert, update, delete on public.growth to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'growth') then
    alter publication supabase_realtime add table public.growth;
  end if;
end $$;

-- (applied right after creation, while the table was still empty: 2-decimal lengths so 21.75 in round-trips exactly)
alter table public.growth alter column length_cm type numeric(6,2), alter column head_cm type numeric(6,2);
