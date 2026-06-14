'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { defaultTheme, FONT_STACKS, type VendorBrand, type VendorTheme } from '@/lib/vendor-context';
import { StorefrontHeader } from '@/components/auth/StorefrontHeader';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ForgotPasswordInner />
    </Suspense>
  );
}

function mergeTheme(vendor: VendorBrand): VendorTheme {
  const base = defaultTheme(vendor.themeColor || '#F1641E');
  if (!vendor.theme) return base;
  return {
    colors: { ...base.colors, ...vendor.theme.colors },
    typography: { ...base.typography, ...vendor.theme.typography },
    header: { ...base.header, ...vendor.theme.header },
    footer: { ...base.footer, ...vendor.theme.footer },
  };
}

function ThemedTokensCss({ t }: { t: VendorTheme }) {
  const css = `
    .vendor-themed { font-family: var(--store-body-font); }
    .vendor-themed h1,
    .vendor-themed h2,
    .vendor-themed h3,
    .vendor-themed h4,
    .vendor-themed .font-display { font-family: var(--store-heading-font); }

    .vendor-themed .text-ink-900 { color: var(--store-text); }
    .vendor-themed .text-ink-700 { color: color-mix(in srgb, var(--store-text) 75%, transparent); }
    .vendor-themed .text-ink-500 { color: color-mix(in srgb, var(--store-text) 55%, transparent); }
    .vendor-themed .text-ink-400 { color: color-mix(in srgb, var(--store-text) 40%, transparent); }

    .vendor-themed .bg-surface { background-color: color-mix(in srgb, var(--store-bg) 92%, white); }
    .vendor-themed .bg-canvas  { background-color: color-mix(in srgb, var(--store-bg) 88%, var(--store-text) 6%); }
    .vendor-themed .bg-white   { background-color: color-mix(in srgb, var(--store-bg) 96%, white); }

    .vendor-themed .border-line { border-color: color-mix(in srgb, var(--store-text) 14%, transparent); }

    .vendor-themed .text-brand-600,
    .vendor-themed .text-brand-700 { color: var(--store-color); }
    .vendor-themed .bg-brand-600   { background-color: var(--store-color); }
    .vendor-themed .bg-brand-50    { background-color: color-mix(in srgb, var(--store-color) 12%, var(--store-bg)); }
    .vendor-themed .border-brand-600 { border-color: var(--store-color); }

    .vendor-themed .shadow-pop { box-shadow: 0 4px 24px color-mix(in srgb, var(--store-text) 10%, transparent); }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '';

  const [vendor, setVendor] = useState<VendorBrand | null>(null);
  const [vendorKey, setVendorKey] = useState(next.startsWith('/') ? next.split('/')[1] : '');
  const [themeConfig, setThemeConfig] = useState<VendorTheme>(defaultTheme());
  const [themeReady, setThemeReady] = useState(false);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const pathKey = next.startsWith('/') ? next.split('/')[1] : '';
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost';
    // On a custom vendor domain the ?next path is slug-less — resolve by domain.
    const isCustomDomain =
      !!host && host !== appDomain && host !== 'localhost' && !host.endsWith('.localhost');

    (async () => {
      try {
        let v: VendorBrand | null = null;
        if (isCustomDomain) {
          v = await api<VendorBrand>(`/api/vendors/by-domain/${encodeURIComponent(host)}`, { auth: false, silent: true });
        } else if (pathKey) {
          v = (await api<{ vendor: VendorBrand }>(`/api/vendors/${pathKey}`, { auth: false, silent: true })).vendor;
        }
        if (v && !cancelled) {
          setVendor(v);
          setThemeConfig(mergeTheme(v));
          setVendorKey(v.slug || v.id);
        }
      } catch {
        // Unresolved — fall back to the default theme.
      } finally {
        if (!cancelled) setThemeReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [next]);

  const t = themeConfig;
  const primary = t.colors.primary;

  const cssVars: React.CSSProperties & Record<string, string> = {
    '--store-color':        primary,
    '--store-accent':       t.colors.accent,
    '--store-bg':           t.colors.background,
    '--store-text':         t.colors.text,
    '--store-header-bg':    t.colors.headerBg,
    '--store-header-text':  t.colors.headerText,
    '--store-footer-bg':    t.colors.footerBg,
    '--store-footer-text':  t.colors.footerText,
    '--store-heading-font': FONT_STACKS[t.typography.headingFont],
    '--store-body-font':    FONT_STACKS[t.typography.bodyFont],
    background: t.colors.background,
    color: t.colors.text,
    fontFamily: FONT_STACKS[t.typography.bodyFont],
    minHeight: '100vh',
  };

  if (!themeReady) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="h-16 border-b border-line bg-surface animate-pulse" />
        <div className="flex items-center justify-center py-24">
          <div className="w-full max-w-md h-64 rounded-2xl bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, vendor: vendorKey || undefined }),
        auth: false,
      });
      setSent(true);
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={cssVars} className="vendor-themed flex flex-col">
      <ThemedTokensCss t={t} />
      <StorefrontHeader vendor={vendor} themeConfig={t} vendorKey={vendorKey} />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl shadow-pop p-7 md:p-9"
            style={{ background: t.colors.background, border: '1px solid rgba(0,0,0,0.10)' }}
          >
            <h1 className="font-display text-3xl mb-1" style={{ color: t.colors.text }}>
              Forgot password?
            </h1>
            <p className="text-sm mb-6" style={{ color: `color-mix(in srgb, ${t.colors.text} 65%, transparent)` }}>
              Enter your email and we'll send you a reset link.
            </p>

            {sent ? (
              <div className="rounded-lg p-4 text-sm"
                style={{ background: 'rgba(22,163,74,0.08)', color: '#15803d', border: '1px solid rgba(22,163,74,0.2)' }}>
                Check your inbox — we've sent a reset link to <strong>{email}</strong>.
                <br />
                <span style={{ color: `color-mix(in srgb, ${t.colors.text} 55%, transparent)` }}>
                  Didn't get it? Check your spam folder or{' '}
                  <button
                    type="button"
                    className="underline"
                    style={{ color: primary }}
                    onClick={() => { setSent(false); setErr(''); }}
                  >
                    try again
                  </button>.
                </span>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wide font-semibold mb-1.5"
                    style={{ color: `color-mix(in srgb, ${t.colors.text} 70%, transparent)` }}>
                    Email
                  </span>
                  <input
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                    style={{
                      background: `color-mix(in srgb, ${t.colors.background} 96%, white)`,
                      color: t.colors.text,
                      borderColor: 'rgba(0,0,0,0.18)',
                    }}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>

                {err && (
                  <div className="rounded-lg text-sm p-3"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#c5221f', border: '1px solid rgba(220,38,38,0.2)' }}>
                    {err}
                  </div>
                )}

                <button
                  disabled={loading}
                  className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: primary, color: '#fff' }}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}

            <p className="text-sm text-center mt-6"
              style={{ color: `color-mix(in srgb, ${t.colors.text} 55%, transparent)` }}>
              Remember it?{' '}
              <Link
                href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="font-semibold hover:underline"
                style={{ color: primary }}
              >
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
