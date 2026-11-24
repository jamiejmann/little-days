-- Little Days migration 009: allow "Today's moments" check-offs as diary entries (additive; existing rows unaffected).
-- A check-off is an entry with type = 'moment', start_at = end_at = when it was ticked, and
-- details = {"m": "<activity id from moments.js>", "tummy": true (tummy-time only)}.
-- No new table and no new policies: moments live in public.entries, so the existing RLS
-- (only members of the baby can read/write its entries), realtime and account-deletion cascade all apply as-is.
-- The feeding alarm only looks at type = 'feed', so moments never reset it.
-- NOT YET APPLIED to the live project. Apply at release time, before shipping the todays-moments branch.
alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check check (type in ('feed','diaper','sleep','pump','medicine','moment'));
