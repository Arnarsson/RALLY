/* RALLY service worker — offline app shell + installable PWA.
 *
 * Dependency-free, intentionally small. Strategy:
 *   - navigations (HTML)      → network-first, fall back to cached shell offline
 *                               (so the schedule is still viewable with no net)
 *   - static same-origin GETs → cache-first (icons, manifest, hashed JS/CSS)
 *   - everything else / cross-origin → pass straight through (fonts, APIs)
 *
 * Bump CACHE when the shell or precache list changes — the activate handler
 * deletes every cache that isn't the current version.
 */

const CACHE = 'rally-v3';

// App shell precached on install. Vite emits hashed asset filenames we can't
// know up front, so we precache the entry points + PWA assets and let the
// runtime cache-first handler pick up the hashed bundles on first visit.
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll is atomic; individual misses would abort it, so add resilient.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // Delete EVERY old cache (not just non-current) so no stale app shell
      // can ever be served once a new SW version ships.
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim())
      // Auto-bust: force-reload every open tab to the fresh build the moment a
      // new SW takes over — this unsticks a client that was holding a broken
      // cached version, with no manual refresh needed.
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => {
        try { c.navigate(c.url); } catch (e) { /* navigate unsupported — ignore */ }
      })),
  );
});

// Allow the page to tell a waiting SW to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations → network-first, offline-fallback to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match('/index.html')),
        ),
    );
    return;
  }

  // Cross-origin (Google Fonts, Supabase, etc.) → don't touch.
  if (!sameOrigin) return;

  // Same-origin static assets → cache-first, then fill the cache.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      });
    }),
  );
});
