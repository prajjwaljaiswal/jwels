import type { Metadata } from 'next';

// Shown when a tenant host does not resolve to an approved/verified vendor. Served with
// HTTP 404 via the middleware rewrite, and marked noindex so crawlers never index it.
// NOTE: a plain (non-underscore) folder — `_`-prefixed folders are private/non-routable
// in the App Router. It is a static segment, so it takes precedence over `[vendorId]`.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TenantUnavailable() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center max-w-md">
        <p className="text-3xl font-semibold text-gray-900 mb-2">Shop unavailable</p>
        <p className="text-gray-600">
          This storefront doesn&rsquo;t exist, isn&rsquo;t published yet, or its domain
          hasn&rsquo;t finished verifying.
        </p>
      </div>
    </div>
  );
}
