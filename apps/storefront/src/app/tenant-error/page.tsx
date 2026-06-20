import type { Metadata } from 'next';

// Shown when the resolver API is temporarily unreachable. Served with HTTP 503 via the
// middleware rewrite (a transient error, NOT a permanent 404) and marked noindex.
// Plain (non-underscore) folder so it is actually routable (see tenant-unavailable).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TenantError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="text-center max-w-md">
        <p className="text-3xl font-semibold text-gray-900 mb-2">Temporarily unavailable</p>
        <p className="text-gray-600">
          We couldn&rsquo;t load this shop right now. Please refresh in a moment.
        </p>
      </div>
    </div>
  );
}
