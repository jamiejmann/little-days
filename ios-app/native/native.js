/* Babyway iOS app layer (Capacitor). Loaded only in the app build, never on the website.
 * - Native push (APNs) instead of Web Push; tokens go to Supabase `device_tokens` via register_device_token().
 * - Native local notifications for the feeding alarm (fallback whenever server push isn't active for this phone).
 * - A short in-app explainer before the iOS notification permission dialog (never a bare system prompt).
 * - Apple's native App Store rating prompt after 7 distinct days of logging, once per app version.
 * - Sign in with Apple (Continue with Apple on the auth screen; the button stays hidden on the website).
 * - Haptics on logging, status bar that follows night mode, splash screen.
 * The web app talks to this file through window.LDNative (onLogged / onAlarmChanged hooks in index.html are no-ops on the website),
 * and exposes what we need through window.__ldApp. Storage keys used here are new and only exist in the app. */
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const P = C.Plugins || {};
  const FS = P.Filesystem, SH = P.Share, PN = P.PushNotifications, LN = P.LocalNotifications, H = P.Haptics, SB = P.StatusBar, App = P.App, IR = P.InAppReview, AS = P.AppleSignIn;
  document.documentElement.classList.add('native');

  async function appleSignIn(hashedNonce) {
    if (!AS || !AS.signIn) return { error: 'unavailable' };
    try {
      const result = await AS.signIn({ scopes: ['EMAIL', 'FULL_NAME'], nonce: hashedNonce });
      if (!result || !result.idToken) return { error: 'no-token' };
      return {
        idToken: result.idToken,
        authorizationCode: result.authorizationCode || null,
        email: result.email || null,
        givenName: result.givenName || null,
        familyName: result.familyName || null
      };
    } catch (e) {
      const msg = String((e && (e.message || e.errorMessage || e)) || '');
      const code = String((e && (e.code || e.errorCode)) || '');
      if (/cancel/i.test(msg + ' ' + code)) return null;
      log('apple sign-in', e);
      return { error: 'failed' };
    }
  }


  /* ---------- safe area: keep the header clear of the clock / Dynamic Island ---------- */
  function fixTopInset() {
    const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;visibility:hidden;padding-top:env(safe-area-inset-top,0px)';
    document.body.appendChild(probe); const got = parseFloat(getComputedStyle(probe).paddingTop) || 0; probe.remove();
    const portrait = innerHeight > innerWidth, tall = Math.max(screen.width, screen.height) >= 812; // Face ID iPhones
    if (got < 20 && portrait) document.documentElement.style.setProperty('--ld-top', (tall ? 50 : 20) + 'px');
    else document.documentElement.style.removeProperty('--ld-top');
  }
  document.addEventListener('DOMContentLoaded', fixTopInset); addEventListener('orientationchange', () => setTimeout(fixTopInset, 300)); addEventListener('resize', fixTopInset);

  const PREF = 'littledays.native.alerts';   // 'on' | 'off'
  const TOKEN = 'littledays.native.apnsToken';
  const SNOOZE = 'littledays.native.notifSnooze'; // ms timestamp: don't auto-ask until then
  const LOGDAYS = 'littledays.native.logDays';    // JSON array of local YYYY-MM-DD days this phone logged
  const REVIEWED = 'littledays.native.reviewFor'; // app version we already asked Apple to prompt for
  const SNOOZE_MS = 3 * 864e5;
  const ALARM_IDS = [7101, 7102];
  const st = { remote: false, checking: null, lastSig: '' };
  const app = () => window.__ldApp;
  const $ = (s) => document.querySelector(s);
  /* Continue with Apple: only shown in the iPhone app, never on the website or PWA. */
  const showApple = () => { const w = $('#appleWrap'); if (w) w.classList.remove('hidden'); };
  showApple();
  document.addEventListener('DOMContentLoaded', showApple);

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
  if (SB && SB.setOverlaysWebView) SB.setOverlaysWebView({ overlay: true }).catch(() => {});
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
        body: `Last feed was at ${fmtT(lf)}. Fed on another phone? Open Babyway to check.`,
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
    if (p === 'denied') { s.textContent = 'Notifications are off for Babyway. Turn them on in Settings → Babyway → Notifications.'; b.classList.add('hidden'); t.classList.add('hidden'); return; }
    if (on() && p === 'granted') {
      s.innerHTML = '✅ <b>Alerts are on for this phone.</b> ' + (st.remote ? 'Sent by our server, so a feed logged on any phone resets them.' : 'Scheduled on this phone from the latest log.');
      b.textContent = 'Turn off'; t.classList.remove('hidden');
    } else { s.textContent = 'Get a gentle notification when a feed is due, even when Babyway is closed.'; b.textContent = 'Enable alerts'; t.classList.add('hidden'); }
  }
  async function enableAlerts() {
    const a = app();
    let p = 'prompt';
    try { p = (await (LN ? LN.requestPermissions() : PN.requestPermissions())).display || 'prompt'; } catch (e) {}
    if (p !== 'granted') { a && a.toast('Notifications were not allowed'); return refreshPushStatus(); }
    try { if (PN) await PN.requestPermissions(); } catch (e) {}
    localStorage.setItem(PREF, 'on');
    localStorage.removeItem(SNOOZE);
    if (a && a.data && a.data.baby && !a.data.baby.feed_alarm_enabled) { const al = $('#alOn'); if (al) { al.checked = true; al.dispatchEvent(new Event('change')); } }
    if (a && a.mode === 'cloud') await registerRemote();
    await scheduleLocal(true);
    a && a.toast('Alerts on 🔔');
    refreshPushStatus();
  }
  async function pushOn() {
    const a = app();
    if (on()) { localStorage.setItem(PREF, 'off'); await dropThisDevice(); await scheduleLocal(true); a && a.toast('Alerts off for this phone'); return refreshPushStatus(); }
    return enableAlerts(); // Enable alerts button already explains why; go straight to the system dialog
  }
  async function test() {
    const a = app();
    if (st.remote) { const r = await callFn('test'); a && a.toast(r && !r.error ? 'Test sent to ' + r.devices + ' device' + (r.devices === 1 ? '' : 's') + ' 🔔' : 'Test failed: ' + (r && r.error)); return; }
    if (!LN) return;
    await LN.schedule({ notifications: [{ id: 7199, title: 'Babyway 🍼', body: 'Test alert: feeding alarms work on this phone.', schedule: { at: new Date(Date.now() + 5000) } }] });
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

  // sign-out / account deletion: forget this phone's alert setup and cancel any scheduled alarms
  async function reset() {
    await dropThisDevice();
    localStorage.removeItem(PREF); st.lastSig = null;
    try { if (LN) await LN.cancel({ notifications: ALARM_IDS.concat([7199]).map((id) => ({ id })) }); } catch (e) {}
    window.__ldScheduled = [];
  }

  /* ---------- pre-permission explainer + Apple's rating prompt ---------- */
  let promptEl = null, explainedThisSession = false;

  function dayKey(d) {
    const t = d instanceof Date ? d : new Date(d);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function hidden(id) { const e = $('#' + id); return !e || e.classList.contains('hidden'); }
  function isQuiet() {
    const appEl = $('#app');
    if (!appEl || appEl.classList.contains('hidden')) return false;
    if (!hidden('authScreen') || !hidden('setupScreen') || !hidden('offlineScreen')) return false;
    const scrim = $('#scrim'); if (scrim && scrim.classList.contains('on')) return false;
    const doc = $('#docView'); if (doc && doc.classList.contains('on')) return false;
    if (promptEl && promptEl.classList.contains('on')) return false;
    return true;
  }
  function isOvernightMoment() {
    if (document.body.classList.contains('night')) return true;
    const D = app() && app().data;
    if (!D || !D.entries) return false;
    const running = D.entries.some((e) => (e.type === 'feed' || e.type === 'sleep' || e.type === 'pump') && !e.end);
    return running && night(Date.now());
  }
  function isCompletedFeed(e) { return !!(e && e.type === 'feed' && (e.subtype !== 'breast' || e.end)); }
  function whenQuiet(fn, tries) {
    const left = tries == null ? 12 : tries;
    if (isQuiet()) { fn(); return; }
    if (left <= 0) return;
    setTimeout(() => whenQuiet(fn, left - 1), 700);
  }

  function ensurePrompt() {
    if (promptEl) return promptEl;
    const wrap = document.createElement('div');
    wrap.id = 'ldNotifPrompt';
    wrap.className = 'ldPrompt';
    wrap.innerHTML = '<div class="ldPromptCard" role="dialog" aria-modal="true" aria-labelledby="ldNotifTitle">'
      + '<div class="ldPromptEmoji" aria-hidden="true">🔔</div>'
      + '<h2 id="ldNotifTitle">Get a gentle reminder when the next feed is due</h2>'
      + "<p>We'll ping this phone when it's time, even if Babyway is closed. You can turn this off anytime in Family.</p>"
      + '<button class="btn peach full" id="ldNotifOn" type="button">Turn on</button>'
      + '<button class="btn ghost full" id="ldNotifLater" type="button">Not now</button>'
      + '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#ldNotifOn').addEventListener('click', async () => { hidePrompt(); await enableAlerts(); });
    wrap.querySelector('#ldNotifLater').addEventListener('click', () => {
      localStorage.setItem(SNOOZE, String(Date.now() + SNOOZE_MS));
      hidePrompt();
    });
    promptEl = wrap;
    return wrap;
  }
  function hidePrompt() { if (promptEl) promptEl.classList.remove('on'); }
  function showPrompt() {
    if (on()) return;
    explainedThisSession = true;
    const el = ensurePrompt();
    el.classList.add('on');
    const btn = el.querySelector('#ldNotifOn'); if (btn) btn.focus();
  }
  async function canExplain() {
    if (on()) return false;
    const p = await perm();
    return p === 'prompt' || p === 'prompt-with-rationale';
  }
  async function maybeExplain(reason) {
    if (promptEl && promptEl.classList.contains('on')) return;
    if (!(await canExplain())) return;
    // "Not now" snoozes the automatic post-feed ask; turning on the feeding alarm is a fresh choice, so we ask again.
    if (reason !== 'alarm') {
      const until = +localStorage.getItem(SNOOZE) || 0;
      if (until > Date.now()) return;
    }
    whenQuiet(() => { if (on()) return; showPrompt(); });
  }

  function recordLogDay() {
    let days = [];
    try { days = JSON.parse(localStorage.getItem(LOGDAYS) || '[]'); } catch (e) { days = []; }
    if (!Array.isArray(days)) days = [];
    const k = dayKey(new Date());
    if (!days.includes(k)) days.push(k);
    days = days.filter((d) => typeof d === 'string').sort().slice(-30);
    localStorage.setItem(LOGDAYS, JSON.stringify(days));
    return days;
  }
  function maybeReview() {
    if (explainedThisSession) return;
    const ver = (window.__ldBuild && window.__ldBuild.version) || '1.0.0';
    if (localStorage.getItem(REVIEWED) === ver) return;
    let days = [];
    try { days = JSON.parse(localStorage.getItem(LOGDAYS) || '[]'); } catch (e) { days = []; }
    if (!Array.isArray(days) || new Set(days).size < 7) return;
    if (isOvernightMoment()) return;
    if (!IR || !IR.requestReview) return;
    whenQuiet(() => {
      if (explainedThisSession) return;
      if (localStorage.getItem(REVIEWED) === ver) return;
      if (isOvernightMoment()) return;
      // Record first so a retry cannot fire again this version, even if Apple hides the dialog.
      localStorage.setItem(REVIEWED, ver);
      IR.requestReview().catch((e) => log('review', e));
    });
  }
  function onLogged(e) {
    recordLogDay();
    if (isCompletedFeed(e)) maybeExplain('feed');
    setTimeout(maybeReview, 2500);
  }
  function onAlarmChanged(enabled) { if (enabled) maybeExplain('alarm'); }

  /* ---------- pediatrician summary: a real PDF, handed to the iOS share sheet (Print, Mail, Messages, Files, AirDrop) ---------- */
  const clean = (t) => String(t).replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, '...').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').replace(/ {2,}/g, ' ');
  function makePdf(text) {
    const J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error('PDF library missing');
    const doc = new J({ unit: 'pt', format: 'letter' }), W = doc.internal.pageSize.getWidth(), Hh = doc.internal.pageSize.getHeight(), M = 54;
    let y = M; const lines = clean(text).split('\n');
    const put = (t, size, bold, color, gap) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
      for (const ln of doc.splitTextToSize(t, W - 2 * M)) { if (y + size > Hh - M) { doc.addPage(); y = M; } doc.text(ln, M, y + size); y += size * 1.35; } y += gap || 0; };
    lines.forEach((l, i) => {
      if (/^Made with Babyway/.test(l)) return;
      if (i === 0) return put(l, 18, true, [43, 39, 64], 4);
      if (i <= 2) return put(l, 11, false, [110, 105, 130], i === 2 ? 6 : 0);
      if (!l.trim()) { y += 8; return; }
      if (/^[A-Z][A-Z0-9 ]{3,}$/.test(l.split(' (')[0])) return put(l, 11.5, true, [43, 39, 64], 2);
      put(l, 11, false, [30, 30, 30]);
    });
    if (y + 40 > Hh - M) { doc.addPage(); y = M; }
    y += 14; put('Made with Babyway · getbabyway.com', 9, false, [140, 135, 155]);
    return doc.output('datauristring').split(',')[1];
  }
  async function shareDoc(text, title) {
    try {
      if (!FS || !SH) throw new Error('share unavailable');
      const name = 'Babyway-summary-' + new Date().toISOString().slice(0, 10) + '.pdf';
      const w = await FS.writeFile({ path: name, data: makePdf(text), directory: 'CACHE' });
      await SH.share({ title, dialogTitle: title, files: [w.uri] });
    } catch (e) {
      if (/cancel/i.test(String(e && (e.message || e)))) return;
      log('shareDoc', e);
      try { if (SH) { await SH.share({ title, text }); return; } } catch (e2) { if (/cancel/i.test(String(e2 && (e2.message || e2)))) return; }
      try { await navigator.clipboard.writeText(text); app() && app().toast('Summary copied. Paste it into a message'); } catch (e3) { app() && app().toast('Could not share right now'); }
    }
  }
  const printDoc = shareDoc; // the iOS share sheet has Print in it

  window.LDNative = { shareDoc, printDoc, refreshPushStatus, pushOn, enableAlerts, test, dropThisDevice, scheduleLocal, reset, onLogged, onAlarmChanged, appleSignIn, _state: st, _plan: plan };
})();
