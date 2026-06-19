'use client';
import { useEffect } from 'react';

// global-error replaces the root layout when the layout itself throws,
// so it must render its own <html>/<body> and use inline styles (globals.css
// may not be applied here).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Vendor global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#faf8f5', color: '#1f2937' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 24px' }}>
            The vendor dashboard hit an unexpected error. Please reload the page.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: '#9d6a3f', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
              style={{ padding: '10px 18px', borderRadius: 999, border: '1px solid #e5e0d8', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
          {error?.digest && (
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 20, fontFamily: 'monospace' }}>Ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
