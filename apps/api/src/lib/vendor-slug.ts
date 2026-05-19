import { prisma } from './prisma';

export const RESERVED_VENDOR_SLUGS = new Set([
  'admin', 'api', 'auth', 'me', 'login', 'register', 'logout',
  'cart', 'checkout', 'orders', 'account', 'wishlist', 'addresses',
  'products', 'product', 'store', 'stores', 'shop', 'shops',
  'vendor', 'vendors', 'category', 'categories', 'collections',
  'search', 'sitemap', 'robots', 'about', 'contact', 'help',
  'support', 'privacy', 'terms', 'static', '_next', 'public',
]);

export function slugifyVendor(name: string): string {
  return (
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    || 'shop'
  );
}

export function isValidVendorSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug);
}

export async function uniqueVendorSlug(base: string, excludeVendorId?: string): Promise<string> {
  let candidate = slugifyVendor(base);
  if (RESERVED_VENDOR_SLUGS.has(candidate)) candidate = `${candidate}-shop`;
  const root = candidate;
  let i = 1;
  while (true) {
    const found = await prisma.vendor.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found || found.id === excludeVendorId) return candidate;
    i += 1;
    candidate = `${root}-${i}`;
  }
}

export const VENDOR_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a URL-segment (vendor UUID or slug) to the canonical vendor id.
 * Returns null when no matching vendor exists.
 */
export async function resolveVendorId(key: string): Promise<string | null> {
  if (!key) return null;
  if (VENDOR_UUID_RE.test(key)) return key;
  const v = await prisma.vendor.findUnique({ where: { slug: key }, select: { id: true } });
  return v?.id ?? null;
}
