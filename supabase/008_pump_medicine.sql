-- Little Days migration 008: allow pumping and medicine entries (additive; existing rows unaffected).
-- Pumping is its own type, so the feeding alarm (which only looks at type = 'feed') is not reset by it.
alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check check (type in ('feed','diaper','sleep','pump','medicine'));
