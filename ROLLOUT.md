# Little Days – rollout notes (Nov 22, 2026)

## Database (Supabase) – additive only
- 002: adds `babies.birth_time` (nullable) and `babies.day_start` (default `'midnight'`, so existing babies look exactly as before).
- 003: adds `babies.feed_alarm_enabled` (default **off**), `feed_interval_min` (default 180), `feed_alarm_night` (default on), `tz` (default `'UTC'`, the app fills in the phone's zone the next time settings are saved). New tables: `push_subscriptions` (own rows only, RLS) and `private.feed_alarm_log`.
- 004: a pg_cron job that only does work if a baby has the alarm switched on.
- No column, table or row was dropped or rewritten. `create_baby` was replaced by a version with an extra *optional* `p_birth_time`, so older app versions that call it with three arguments still work.

## App updates (service worker `sw.js`)
- Versioned cache (`little-days-v5`). Bump the name on every release; old caches are deleted on activate.
- The page and `sw.js` are always fetched network-first, bypassing the browser cache (`cache: 'no-cache'`); the cached copy is used only offline.
- `skipWaiting()` + `clients.claim()`. The page checks for updates whenever it comes back to the foreground and every 30 minutes.
- When a new version takes over, the app waits until no sheet is open and nothing is being typed. It saves the offline queue, reloads, and shows "Updated ✨". Running feed and sleep timers are stored as entries, so a reload doesn't stop them.
- Storage keys are unchanged since the first release: `littledays.queue`, `littledays.mode`, `littledays.baby`, `littledays.prefs`, `littledays.v2.demo`.
- New: opening the app offline while signed in now shows a "You're offline" screen instead of the sign-in screen, and it reopens on its own when the network returns. Before, the app looked signed out, though no data was lost.

## Upgrade test (local copy of each release, temp accounts, then deleted)
| Step | Result |
|---|---|
| v1 (first release, no SW): sign in, log a diaper offline | queue = 1 |
| Open v2 (SW era) | queue flushed, both entries on server |
| v2 offline: diaper + start sleep, reload offline from SW cache | queue = 2 kept |
| Deploy this version while the v2 page is open, reopen | new SW took over, old caches removed, queue flushed (0), sleep timer still running, keys unchanged |
| This version: offline diaper, then a newer release ships while the Feed sheet is open | no reload while the sheet is open; reload right after it closes, "Updated ✨" toast, queue flushed, timer still running |
| Demo user from v1 opens this version | all 100 demo entries kept, no errors |
| Offline cold start while signed in | "You're offline" screen; back online → app live with data |

---

# Phase 2: growth, pediatrician summary, "same bottle again" (Nov 22, 2026)

## Database: migration `005_growth_summary.sql` (additive only)
- `babies.sex`: nullable, `'female'|'male'`, unset by default. It is only used for WHO percentiles.
- `babies.doctor_notes`: text, default `''`, max 4000 characters. Shared notes for the doctor.
- New table `public.growth`, one row per measurement: `measured_on`, `weight_g`, `length_cm`, `head_cm`.
  - Each value is optional, but at least one is required. There are sanity range checks.
  - Row-level security matches `entries`: members read/edit/delete, and members insert as themselves. No access for anon.
  - Realtime is on.
- The only change to an existing object is two new columns on `babies`; no rows are rewritten. The length/head precision was widened while the new table was still empty.
- Older app versions never send `sex` or `doctor_notes`, so saving the profile from an old version leaves them untouched. This is tested.

## App
- Service worker cache `little-days-v6`. It precaches `who-lms.js` so percentiles work offline. The update flow is the same as before, and the app won't reload while the pediatrician summary is open.
- The offline queue key is unchanged (`littledays.queue`). New growth items carry `t:'growth'`; items without `t` (all older ones) are still diary entries.
- Demo data saved by older versions gets `growth: []`. "Reload sample data" adds sample measurements.

## Upgrade test (current live version → this version, temp accounts, then deleted)
| Step | Result |
|---|---|
| Returning user on current live version, offline: diaper + start sleep | queue = 2 |
| New version deployed while open | auto-reload with "Updated ✨", queue flushed, sleep timer still running, cache v6 only |
| Growth measurement added offline | queued as `insert:growth`, flushed when back online |
| Partner joins on new version | sees growth, sex, doctor notes; live sync both ways for growth and the Again bottle |
| Same parent on a 2nd phone still on the OLD version renames the baby and logs a diaper | name updated, sex and notes kept, diaper synced |
| Outsider account / anonymous | outsider reads 0 growth rows, insert blocked (42501), can't read notes; anon gets 401 |
| Demo user on current version → new | all entries kept, growth starts empty, no errors |

## WHO percentiles
- Data: WHO Child Growth Standards expanded tables (L, M, S by day, 0–730 days) for weight-for-age, length-for-age and head-circumference-for-age, girls and boys. They were downloaded from who.int and copied unchanged into `who-lms.js`; the sources are in its header.
- Method: LMS z-score, with WHO's restricted extension beyond ±3 SD, and percentile = Φ(z).
- Check: the code reproduces 252 published percentile values (P0.1, P3, P15, P50, P85, P97, P99.9 at 6 ages, all 6 tables) within 0.03 percentile points. The tiny difference comes from rounding in the tables.
- Labelled in the app and on the summary as "for information only, not medical advice".

## iOS app groundwork (website unchanged)
- **Migration 006 `native_push`** is additive only. It adds a new `device_tokens` table (RLS: users can read and delete only their own rows; anon gets nothing) and new RPCs `register_device_token` / `unregister_device_token`, plus a service-role-only `feed_alarm_claim_babies`. No existing table, row or function was changed. `feed_alarm_claim` is untouched.
- **Edge Function `feed-alarm` v2**: Web Push behaves exactly as before. It also sends APNs to iPhone app tokens, but only when the `APNS_*` secrets are set; until then it returns `apns-disabled`. New `status` action for the app. Tested: status/test/cron runs; anon 401; non-service users 403 on the claim; outsiders can't read or insert tokens.
- **Website files** (`index.html`, `sw.js` cache `little-days-v6`, storage keys) are unchanged. The `ios-app/` project and `APP_STORE_STEPS.md` are kept out of the Pages site by `_config.yml`.
- The app adds two new storage keys of its own: `littledays.native.alerts` and `littledays.native.apnsToken`. All existing keys are shared, unchanged.
