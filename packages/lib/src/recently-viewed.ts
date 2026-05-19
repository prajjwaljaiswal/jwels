const STORAGE_KEY = 'recentlyViewedProducts';
const MAX = 12;

export function getRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(productId: string): void {
  if (typeof window === 'undefined') return;
  const current = getRecentlyViewed().filter((id) => id !== productId);
  current.unshift(productId);
  const trimmed = current.slice(0, MAX);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}
