/* RALLY web push — client half.
 *
 * Tiny, dependency-free. Subscribes the device to push and hands the
 * subscription to our own API (`/api/push/subscribe`), which stores it and
 * later sends goal alerts via the Edge Function.
 *
 * Guards: this is a NO-OP on the standalone `file://` build (no server to POST
 * to, no real SW) and anywhere the Push/Notification APIs are missing. Every
 * exported function fails soft so callers never have to feature-detect.
 */

// Safe to ship in the client — VAPID *public* key only (the private key lives
// in a server secret, never here).
const VAPID_PUBLIC_KEY =
  'BOW1RuIFqOJJ6WjNjzPDwI5UHZmqCKBecoFUo9JsM6l7bViluVA8fBK9c7NCOVNyjPGgH6uEz1SjdGGkYnZcfGQ';

// True only in a real served context — never on the standalone file:// build.
const isWeb =
  typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:';

/** Are the APIs we need present (and are we not on file://)? */
export function pushSupported() {
  return (
    isWeb &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Current notification permission, normalised. */
export function pushStatus() {
  if (!pushSupported()) return 'unsupported';
  // Notification.permission → 'granted' | 'denied' | 'default'
  return Notification.permission;
}

// Standard VAPID key decoder: URL-safe base64 → Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Ask for permission, subscribe via the service worker, and register the
 * subscription with our API. Returns {ok:true} on success, else
 * {ok:false, reason}. Never throws.
 */
export async function enablePush(userId) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: permission }; // 'denied' | 'default'

    const reg = await navigator.serviceWorker.ready;

    // Reuse an existing subscription if the browser already has one.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        userId: userId || null,
        ua: navigator.userAgent,
      }),
    });
    if (!res.ok) return { ok: false, reason: 'subscribe-failed' };

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: (err && err.message) || 'error' };
  }
}
