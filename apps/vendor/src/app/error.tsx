'use client';
import { useEffect } from 'react';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error so it shows up in logs / monitoring instead of vanishing silently.
    console.error('Vendor route error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-12 w-12 rounded-full bg-amber-50 text-warn items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h1 className="font-display text-2xl text-ink-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-ink-700 mb-6">
          This page hit an unexpected error. Try again, or reload the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => reset()} className="btn-primary">Try again</button>
          <button
            type="button"
            onClick={() => { if (typeof window !== 'undefined') window.location.assign('/'); }}
            className="btn-secondary"
          >
            Reload dashboard
          </button>
        </div>
        {error?.digest && (
          <p className="text-[11px] text-ink-500 mt-5 font-mono">Ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
