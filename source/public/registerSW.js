// RALLY — service worker registration helper.
//
// Registers /sw.js for offline support + installability, but ONLY in a
// production build (import.meta.env.PROD) so the SW never caches anything during
// `npm run dev`. No-ops when the browser lacks service worker support, or when
// running from file:// (the double-click standalone "RALLY — open me.html",
// where SWs aren't allowed).
//
// LEAD: add this ONE line to source/src/main.jsx (e.g. just after the
// createRoot(...).render(...) call):
//
//     import { registerSW } from '../public/registerSW.js'; registerSW();
//
// (Vite resolves the relative path from src/; the file sits in public/ next to
// the manifest and icons it documents.)

export function registerSW() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env || !import.meta.env.PROD) return;
  if (window.location.protocol === 'file:') return;

  // Auto-bust: when a new service worker takes control, reload ONCE to the fresh
  // build. This unsticks a client holding a broken cached version after a deploy
  // — no manual hard-refresh required.
  //
  // CRITICAL: only reload on a genuine UPDATE (a controller was already in place
  // when this page loaded). The first visit has no controller; the SW's
  // clients.claim() then fires `controllerchange`, and reloading there double-
  // loads every first-time visitor — ~1.9s of wasted FCP (Lighthouse logs it as
  // a redirect-to-self). hadController is false on the first visit, true on
  // return visits, so the auto-bust still works for deploys without the penalty.
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Proactively check for a newer SW on load and every 30 min, so an open
        // tab picks up a deploy without waiting for a navigation.
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((err) => {
        // Non-fatal: the app works without offline support.
        console.warn('[RALLY] SW registration failed:', err);
      });
  });
}
