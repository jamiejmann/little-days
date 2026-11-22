/* Little Days iOS app layer (Capacitor). Loaded only in the app build, never on the website.
 * - Native push (APNs) instead of Web Push; tokens go to Supabase `device_tokens` via register_device_token().
 * - Native local notifications for the feeding alarm (fallback whenever server push isn't active for this phone).
 * - Haptics on logging, status bar that follows night mode, splash screen.
 * The web app talks to this file through window.LDNative (hooks added by scripts/build-web.mjs at build time),
 * and exposes what we need through window.__ldApp. Storage keys used here are new and only exist in the app. */
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const P = C.Plugins || {};
  const PN = P.PushNotifications, LN = P.LocalNotifications, H = P.Haptics, SB = P.StatusBar, App = P.App;
  document.documentElement.classList.add('native');

  const PREF = 'littledays.native.alerts';   // 'on' | 'off'
  const TOKEN = 'littledays.native.apnsToken';
  const ALARM_IDS = [7101, 7102];
  const st = { remote: false, checking: null, lastSig: '' };
  const app = () => window.__ldApp;
  const $ = (s) => document.querySelector(s);
  const on = () => localStorage.getItem(PREF) === 'on';
  const log = (...a) => { try { console.log('[LDNative]', ...a); } catch (e) {} };

  /* ---------- haptics ---------- */
  const tapSel = '.bigbtn,.dbtn,.side,#bAgain,#abLog,.seg button,nav button,#alOn,#alNight,.chip';
  const saveSel = '#bSave,#fSave,#gSave,.dbtn,#bAgain,#abLog';
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest(tapSel + ',' + saveSel);
    if (!t || !H) return;
    if (t.matches(saveSel)) H.notification({ type: 'SUCCESS' }).catch(() => {});
    else H.impact({ style: 'LIGHT' }).catch(() => {});
    if (t.closest('#bSleep,#bFeed,#bDiaper,.dbtn,#bSave,#fSave,#bAgain,#abLog,#alOn,#alInt,#alNight')) setTimeout(() => scheduleLocal(true), 1500);
  }, true);
  document.addEventListener('change', (e) => { if (e.target && e.target.closest && e.target.closest('#alOn,#alInt,#alNight')) setTimeout(() => scheduleLocal(true), 1500); }, true);

  /* ---------- status bar follows night mode ---------- */
  const paintBar = () => { if (SB) SB.setStyle({ style: document.body.classList.contains('night') ? 'DARK' : 'LIGHT' }).catch(() => {}); };
  document.addEventListener('DOMContentLoaded', () => { paintBar(); new MutationObserver(paintBar).observe(document.body, { attributes: true, attributeFilter: ['class'] }); });

  /* ---------- server push (APNs) ---------- */
  async function callFn(action) {
    const a = app(); if (!a || !a.sb) return null;
    const { data } = await a.sb.auth.getSession(); if (!data.session) return null;
    return fetch(a.alarmFn, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token, apikey: a.supabaseKey }, body: JSON.stringify({ action }) })
      .then((r) => r.json()).catch((e) => ({ error: String(e) }));
  }
  async function saveToken(token) {
    const a = app(); if (!a || a.mode !== 'cloud' || !a.sb || !a.user) return false;
    const { error } = await a.sb.rpc('register_device_token', { p_token: token, p_environment: 'production', p_app_version: (window.__ldBuild && window.__ldBuild.version) || null });
    if (error) { log('token save failed', error.message); return false; }
    localStorage.setItem(TOKEN, token); return true;
  }
  async function checkRemote() {
    // server push is "active" only when this phone has a saved token AND the server has an APNs key configured
    if (!localStorage.getItem(TOKEN) || !app() || app().mode !== 'cloud') { st.remote = false; return false; }
    const r = await callFn('status');
    st.remote = !!(r && r.apns && r.thisDevice);
    return st.remote;
  }
  if (PN) {
    PN.addListener('registration', async (t) => { log('apns token'); if (await saveToken(t.value)) await checkRemote(); scheduleLocal(true); refreshPushStatus(); });
    PN.addListener('registrationError', (e) => { log('apns registration error', e && e.error); st.remote = false; scheduleLocal(true); });
    PN.addListener('pushNotificationActionPerformed', () => { /* opening the app is enough */ });
  }
  async function registerRemote() {
    if (!PN) return;
    try { const p = await PN.checkPermissions(); if (p.receive === 'granted') await PN.register(); } catch (e) { log('register failed', e); }
  }

  /* ---------- local notifications: the reliable fallback ---------- */
  const night = (t) => { const h = new Date(t).getHours(); return h >= 22 || h < 6; };
  const fmtT = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function plan() {
    const a = app(), D = a && a.data;
    if (!on() || st.remote || !D || !D.baby || !D.baby.feed_alarm_enabled) return [];
    const feeds = (D.entries || []).filter((e) => e.type === 'feed');
    if (feeds.some((e) => !e.end)) return [];               // a feed is in progress
    const lf = feeds.reduce((m, e) => Math.max(m, e.start), 0); if (!lf) return [];
    const due = lf + (D.baby.feed_interval_min || 180) * 60000, name = D.baby.name || 'Baby';
    return [[ALARM_IDS[0], due, 'due'], [ALARM_IDS[1], due + 15 * 60000, 'followup']]
      .filter(([, t]) => t > Date.now() + 5000 && (D.baby.feed_alarm_night !== false || !night(t)))
      .map(([id, t, k]) => ({
        id, title: k === 'due' ? `${name}'s feed is due 🍼` : `Reminder: ${name}'s feed`,
        body: `Last feed was at ${fmtT(lf)}. Fed on another phone? Open Little Days to check.`,
        schedule: { at: new Date(t), allowWhileIdle: true }, threadIdentifier: 'feed-' + D.baby.id, extra: { babyId: D.baby.id, kind: k },
      }));
  }
  async function scheduleLocal(force) {
    if (!LN) return;
    const list = plan(), sig = JSON.stringify(list.map((n) => [n.id, +n.schedule.at, n.title]));
    if (!force && sig === st.lastSig) return;
    st.lastSig = sig;
    try {
      await LN.cancel({ notifications: ALARM_IDS.map((id) => ({ id })) });
      if (list.length) await LN.schedule({ notifications: list });
      window.__ldScheduled = list.map((n) => ({ id: n.id, at: n.schedule.at.toISOString(), title: n.title }));
    } catch (e) { log('schedule failed', e); }
  }
  setInterval(() => scheduleLocal(false), 30000);
  if (App) {
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) { await checkRemote().catch(() => {}); }
      scheduleLocal(true);   // also right before the app goes to the background
    });
  }

  /* ---------- the "Alerts on this phone" card ---------- */
  async function perm() { try { return (await (LN || PN).checkPermissions()).display || (await PN.checkPermissions()).receive; } catch (e) { return 'prompt'; } }
  async function refreshPushStatus() {
    const s = $('#pushStatus'), b = $('#pushOn'), t = $('#pushTest'); if (!s) return;
    const steps = $('#iosSteps'); if (steps) steps.classList.add('hidden');
    b.classList.remove('hidden');
    const p = await perm();
    if (p === 'denied') { s.textContent = 'Notifications are off for Little Days. Turn them on in Settings → Little Days → Notifications.'; b.classList.add('hidden'); t.classList.add('hidden'); return; }
    if (on() && p === 'granted') {
      s.innerHTML = '✅ <b>Alerts are on for this phone.</b> ' + (st.remote ? 'Sent by our server, so a feed logged on any phone resets them.' : 'Scheduled on this phone from the latest log.');
      b.textContent = 'Turn off'; t.classList.remove('hidden');
    } else { s.textContent = 'Get a gentle notification when a feed is due, even when Little Days is closed.'; b.textContent = 'Enable alerts'; t.classList.add('hidden'); }
  }
  async function pushOn() {
    const a = app();
    if (on()) { localStorage.setItem(PREF, 'off'); await dropThisDevice(); await scheduleLocal(true); a && a.toast('Alerts off for this phone'); return refreshPushStatus(); }
    let p = 'prompt';
    try { p = (await (LN ? LN.requestPermissions() : PN.requestPermissions())).display || 'prompt'; } catch (e) {}
    if (p !== 'granted') { a && a.toast('Notifications were not allowed'); return refreshPushStatus(); }
    try { if (PN) await PN.requestPermissions(); } catch (e) {}
    localStorage.setItem(PREF, 'on');
    if (a && a.data && a.data.baby && !a.data.baby.feed_alarm_enabled) { const al = $('#alOn'); if (al) { al.checked = true; al.dispatchEvent(new Event('change')); } }
    if (a && a.mode === 'cloud') await registerRemote();
    await scheduleLocal(true);
    a && a.toast('Alerts on 🔔');
    refreshPushStatus();
  }
  async function test() {
    const a = app();
    if (st.remote) { const r = await callFn('test'); a && a.toast(r && !r.error ? 'Test sent to ' + r.devices + ' device' + (r.devices === 1 ? '' : 's') + ' 🔔' : 'Test failed: ' + (r && r.error)); return; }
    if (!LN) return;
    await LN.schedule({ notifications: [{ id: 7199, title: 'Little Days 🍼', body: 'Test alert: feeding alarms work on this phone.', schedule: { at: new Date(Date.now() + 5000) } }] });
    a && a.toast('Test alert in 5 seconds. You can close the app 🔔');
  }
  async function dropThisDevice() {
    const a = app(), tok = localStorage.getItem(TOKEN);
    try { if (tok && a && a.sb) await a.sb.rpc('unregister_device_token', { p_token: tok }); } catch (e) {}
    localStorage.removeItem(TOKEN); st.remote = false;
    try { if (PN) await PN.unregister(); } catch (e) {}
  }
  // after sign-in / app start: re-register so the token stays fresh, then decide local vs server alerts
  setTimeout(async () => { if (on() && app() && app().mode === 'cloud') await registerRemote(); await checkRemote().catch(() => {}); scheduleLocal(true); }, 4000);

  window.LDNative = { refreshPushStatus, pushOn, test, dropThisDevice, scheduleLocal, _state: st, _plan: plan };
})();
