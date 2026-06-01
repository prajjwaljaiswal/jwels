import { NextRequest, NextResponse } from 'next/server';

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost';
const API_URL    = process.env.NEXT_PUBLIC_API_URL    || 'http://localhost:4000';

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host') ?? '';
  const domain   = hostname.split(':')[0]; // strip port

  // Skip internal Next.js paths, API routes, and the main app domain
  if (
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/api') ||
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
      // Rewrite to the vendor store page while keeping the custom domain in the browser URL
      const url = req.nextUrl.clone();
      url.pathname = `/${vendor.slug || vendor.id}${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
      return NextResponse.rewrite(url);
    }
  } catch {
    // If the API is unreachable, fall through to normal routing
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
