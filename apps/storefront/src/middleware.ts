import { NextRequest, NextResponse } from 'next/server';

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost';
const API_URL    = process.env.NEXT_PUBLIC_API_URL    || 'http://localhost:4000';

// App-level routes that live at the root (not under /[vendorId]). These must NOT
// be prefixed with the vendor slug on a custom domain, or they 404 (there is no
// /[vendorId]/login route — login/register/etc. resolve the vendor themselves).
const ROOT_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') ?? '';
  const domain   = hostname.split(':')[0]; // strip port
  const pathname = req.nextUrl.pathname;

  // Skip internal Next.js paths, API routes, the main app domain, and the
  // shared app-level routes that are not vendor-scoped.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/push-sw.js' ||           // static service worker — serve as-is, never vendor-prefix
    ROOT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ||
    domain === APP_DOMAIN ||
    domain === 'localhost' ||
    domain.endsWith('.localhost')
  ) {
    return NextResponse.next();
  }

  // Attempt to resolve a vendor by this custom domain
  try {
    const res = await fetch(`${API_URL}/api/vendors/by-domain/${encodeURIComponent(domain)}`);
    if (res.ok) {
      const vendor = await res.json();
      const slug = vendor.slug || vendor.id;

      // If the path already starts with the vendor slug (client-side navigation
      // generates /${slug}/... links), skip the rewrite to avoid double-prefixing.
      if (pathname.startsWith(`/${slug}`)) {
        return NextResponse.next();
      }

      // Rewrite to the vendor store path while keeping the custom domain in the browser URL
      const url = req.nextUrl.clone();
      url.pathname = `/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.rewrite(url);
    }
  } catch {
    // If the API is unreachable, fall through to normal routing
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|push-sw.js).*)'],
};
