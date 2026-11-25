// Babyway service worker: offline app shell + feeding-alarm notifications
// bump this version on every release; old caches are removed on activate
const CACHE = 'little-days-v33';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './who-lms.js', './privacy.html', './terms.html'];
// install: cache: 'reload' skips the HTTP cache so a new release never precaches an old file
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // network first (always fresh when online), cached copy when offline
    // pages bypass the browser's HTTP cache so a new version shows up on the next open
    const fresh = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('sw.js');
    e.respondWith((fresh ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req)).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return r; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
  } else if (url.hostname === 'esm.sh') {
    // the database library: use cached copy if present, refresh in background
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Babyway', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Babyway 🍼', {
    body: d.body || 'A feed is due.', tag: d.tag || 'little-days', renotify: true,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
