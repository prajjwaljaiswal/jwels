// Web Push (browser notification) client. Registers a service worker, subscribes
// via the PushManager using the server's VAPID public key, and stores the
// subscription server-side. `urlTemplate` is the per-app deep link with an {id}
// placeholder so the service worker can open the right ticket.

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';
const SW_PATH = '/push-sw.js';

function authHeaders(): Record<string, string> {
  const t = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  // Build on an explicit ArrayBuffer so the inferred type is Uint8Array<ArrayBuffer>,
  // which satisfies BufferSource under the strict DOM lib typings.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied';

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission as PushState;
}

/** Returns true once the browser is subscribed and the server has the record. */
export async function enablePush(urlTemplate: string): Promise<boolean> {
  if (!pushSupported()) throw new Error('Notifications are not supported on this browser');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const reg = await navigator.serviceWorker.register(SW_PATH);
  await navigator.serviceWorker.ready;

  const keyRes = await fetch(`${API}/api/support/push/key`, { headers: authHeaders() });
  const { key } = await keyRes.json().catch(() => ({ key: null }));
  if (!key) throw new Error('Push is not configured on the server');

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  const json = sub.toJSON() as { keys?: { p256dh: string; auth: string } };
  if (!json.keys) throw new Error('Could not read push keys');

  const res = await fetch(`${API}/api/support/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys, urlTemplate }),
  });
  if (!res.ok) throw new Error('Could not save the subscription');
  return true;
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch(`${API}/api/support/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
