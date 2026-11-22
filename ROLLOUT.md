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
