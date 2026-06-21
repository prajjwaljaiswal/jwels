'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { setToken } from '@/lib/api';

// Receives a signed-in seller from the marketing/onboarding app (a different origin).
// The JWT arrives in the URL hash (#token=…) — read it, store it in this origin's
// localStorage, drop the hash, and hard-navigate to the dashboard so the auth guard
// (useMe) re-checks with the fresh token and the seller lands already logged in.
export default function VendorHandoffPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get('token');
      const next = params.get('next');
      const dest = next && next.startsWith('/') ? next : '/';
      if (!token) {
        window.location.replace('/auth/login');
        return;
      }
      setToken(token);
      window.location.replace(dest); // full load → dashboard auth re-checks; hash is dropped
    } catch {
      setFailed(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <p className="text-sm text-ink-500">
        {failed ? 'Could not sign you in — please log in.' : 'Signing you in…'}
      </p>
    </div>
  );
}
