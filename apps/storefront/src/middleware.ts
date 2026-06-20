import { NextRequest, NextResponse } from 'next/server';
import { classifyHost } from './lib/tenant-host';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// App-level routes that live at the root (not under /[vendorId]). These must NOT be
// prefixed with the vendor slug on a tenant host, or they 404 (there is no
// /[vendorId]/login route — login/register/etc. resolve the vendor themselves).
const ROOT_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

type Resolved = { vendorId: string; slug: string; themeVersion: number };

// Best-effort, process-local resolution cache. NOT a correctness dependency: the Edge
// runtime does not guarantee module state persists across invocations, and it is
// per-process anyway. The durable cache is the API's Cache-Control (s-maxage) response.
const cache = new Map<string, { value: Resolved | null; exp: number }>();
const TTL_MS = 30_000;

async function resolveHost(
  by: 'subdomain' | 'domain',
  key: string
): Promise<{ value: Resolved | null; transient: boolean }> {
  const ck = `${by}:${key}`;
  const hit = cache.get(ck);
  if (hit && hit.exp > Date.now()) return { value: hit.value, transient: false };
  try {
    const res = await fetch(`${API_URL}/api/vendors/resolve?by=${by}&key=${encodeURIComponent(key)}`);
    if (res.status === 404) {
      cache.set(ck, { value: null, exp: Date.now() + TTL_MS }); // cache "not a tenant"
      return { value: null, transient: false };
    }
    if (!res.ok) return { value: null, transient: true }; // 5xx etc → transient, don't cache
    const value = (await res.json()) as Resolved;
    cache.set(ck, { value, exp: Date.now() + TTL_MS });
    return { value, transient: false };
  } catch {
    return { value: null, transient: true }; // API unreachable → transient
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1) Never touch Next internals or the storefront's own API routes (e.g. /api/revalidate).
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const host = classifyHost(req.headers.get('host') ?? '');

  // 2) App domain / localhost → existing path-based /[vendorId] routing, untouched.
  if (host.kind === 'app') return NextResponse.next();

  // 3) Tenant host (subdomain or custom domain) → resolve to a vendor.
  const by = host.kind === 'subdomain' ? 'subdomain' : 'domain';
  const { value, transient } = await resolveHost(by, host.key);

  if (!value) {
    // Distinguish a permanent "not a tenant / unverified / unapproved" (404) from a
    // transient "resolver API unreachable" (503), so a brief outage is never cached or
    // indexed as a permanent shop-gone page.
    const target = transient ? '/tenant-error' : '/tenant-unavailable';
    return NextResponse.rewrite(new URL(target, req.url), { status: transient ? 503 : 404 });
  }

  const slug = value.slug || value.vendorId;

  // Root app-level routes (login/register/…) — resolve identity but do NOT prefix.
  if (ROOT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next();
  }

  // Static assets served from /public (anything with a file extension, e.g. /push-sw.js,
  // /robots.txt, /sitemap.xml) live at the root — never prefix them.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // Already slug-prefixed (client-side nav builds /${slug}/… links) — don't double-prefix.
  if (pathname === `/${slug}` || pathname.startsWith(`/${slug}/`)) {
    return NextResponse.next();
  }

  // Rewrite the tenant host's path into the existing /[vendorId] route tree, keeping the
  // tenant host in the browser address bar.
  const url = req.nextUrl.clone();
  url.pathname = `/${slug}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
