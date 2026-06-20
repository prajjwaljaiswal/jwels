import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { classifyHost } from '../lib/tenant-host';

// Per-host robots. Reading the Host header makes this dynamic, so each tenant host
// (and the app domain) gets robots pointing at its own sitemap.
export default function robots(): MetadataRoute.Robots {
  const h = headers();
  const host = (h.get('host') ?? '').split(':')[0];
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const base = `${proto}://${host}`;
  // classifyHost is currently informational here (both branches allow crawling); kept
  // explicit so app-domain-specific rules can be added later without reshaping this file.
  classifyHost(host);
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${base}/sitemap.xml`,
  };
}
