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

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        // Non-fatal: the app works without offline support.
        console.warn('[RALLY] SW registration failed:', err);
      });
  });
}
