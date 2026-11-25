/* ChangeYourself service worker (2026-11-25) — app-shell cache ONLY.
 *
 * What it caches: the static shell (mock-test app, hub, styles, scripts,
 * logos) so the app opens offline. It NEVER caches question data, answers,
 * or any Supabase/API response — those come from IndexedDB packages and
 * the server, not the cache.
 *
 * Version the cache name (cy-shell-v1) whenever the shell changes; the
 * activate handler deletes older caches. Install is per-file and
 * failure-tolerant, so a deployment-protection wall (staging preview)
 * cannot break the whole install — files that cannot be fetched are
 * simply skipped.
 */
var CACHE = 'cy-shell-v1';
var SHELL = [
  '/changexed/mock-tests/',
  '/changexed/',
  '/styles.css',
  '/main.js',
  '/supabase.js',
  '/supabase-js.min.js',
  '/auth.js',
  '/offline.js',
  '/logo.png',
  '/changexed-logo-dark.png',
  '/changexed-logo-light.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // never touch Supabase or other origins
  if (url.pathname.indexOf('/rest/') === 0 || url.pathname.indexOf('/auth/') === 0) return; // never cache API calls
  var isShell = SHELL.some(function (p) { return url.pathname === p || url.pathname === p.replace(/\/$/, ''); });
  if (isShell) {
    // Shell assets: cache-first, refresh in the background.
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
        var network = fetch(e.request).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }
  if (e.request.mode === 'navigate') {
    // Page navigation: network first, fall back to the cached mock-test app.
    e.respondWith(
      fetch(e.request).catch(function () { return caches.match('/changexed/mock-tests/', { ignoreSearch: true }); })
    );
  }
});
