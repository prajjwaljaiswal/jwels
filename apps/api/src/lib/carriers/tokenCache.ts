import { createHash } from 'crypto';

// In-process TTL cache for OAuth/session tokens. Keyed by a stable hash of the
// credential blob + carrier + mode so a credential rotation invalidates implicitly.
// Suitable for a single-node deployment; swap for Redis if running multi-node.

interface Entry { token: string; expiresAt: number }

const store = new Map<string, Entry>();

export function tokenKey(carrier: string, mode: string, credentials: Record<string, unknown>): string {
  const h = createHash('sha256');
  h.update(carrier);
  h.update('|');
  h.update(mode);
  h.update('|');
  h.update(JSON.stringify(credentials));
  return h.digest('hex');
}

export function getCachedToken(key: string): string | null {
  const e = store.get(key);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return e.token;
}

export function setCachedToken(key: string, token: string, ttlSeconds: number): void {
  // Subtract a small safety margin so we never serve a token in its last second.
  const ttl = Math.max(30, ttlSeconds - 30);
  store.set(key, { token, expiresAt: Date.now() + ttl * 1000 });
}

export function clearCachedToken(key: string): void {
  store.delete(key);
}
