'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { defaultTheme, FONT_STACKS, type VendorBrand, type VendorTheme } from '@/lib/vendor-context';
import { StorefrontHeader } from '@/components/auth/StorefrontHeader';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ResetPasswordInner />
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

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const vendorKey = searchParams.get('vendor') || '';

  const [vendor, setVendor] = useState<VendorBrand | null>(null);
  const [themeConfig, setThemeConfig] = useState<VendorTheme>(defaultTheme());
  const [themeReady, setThemeReady] = useState(!vendorKey);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const [matchErr, setMatchErr] = useState('');

  useEffect(() => {
    if (!vendorKey) return;
    api<{ vendor: VendorBrand }>(`/api/vendors/${vendorKey}`, { auth: false, silent: true })
      .then(({ vendor }) => {
        setVendor(vendor);
        setThemeConfig(mergeTheme(vendor));
      })
      .catch(() => {})
      .finally(() => setThemeReady(true));
  }, [vendorKey]);

  useEffect(() => {
    if (!token) setErr('No reset token found. Please request a new reset link.');
  }, [token]);

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
          <div className="w-full max-w-md h-80 rounded-2xl bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMatchErr('');
    setErr('');

    if (password !== confirm) {
      setMatchErr('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
        auth: false,
      });
      setDone(true);
      const loginHref = `/login${vendorKey ? `?next=/${vendorKey}` : ''}`;
      setTimeout(() => router.push(loginHref), 2500);
    } catch (e: any) {
      setErr(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `/login${vendorKey ? `?next=/${vendorKey}` : ''}`;

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
              Set new password
            </h1>
            <p className="text-sm mb-6" style={{ color: `color-mix(in srgb, ${t.colors.text} 65%, transparent)` }}>
              Choose a strong password — at least 6 characters.
            </p>

            {done ? (
              <div className="rounded-lg p-4 text-sm"
                style={{ background: 'rgba(22,163,74,0.08)', color: '#15803d', border: '1px solid rgba(22,163,74,0.2)' }}>
                Password reset successful! Redirecting you to sign in…
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <label className="block">
                  <span className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase tracking-wide font-semibold"
                      style={{ color: `color-mix(in srgb, ${t.colors.text} 70%, transparent)` }}>
                      New Password
                    </span>
                    <button type="button" onClick={() => setShowPass((s) => !s)}
                      className="text-xs hover:underline"
                      style={{ color: `color-mix(in srgb, ${t.colors.text} 55%, transparent)` }}>
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </span>
                  <input
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                    style={{
                      background: `color-mix(in srgb, ${t.colors.background} 96%, white)`,
                      color: t.colors.text,
                      borderColor: 'rgba(0,0,0,0.18)',
                    }}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </label>

                <label className="block">
                  <span className="block text-xs uppercase tracking-wide font-semibold mb-1.5"
                    style={{ color: `color-mix(in srgb, ${t.colors.text} 70%, transparent)` }}>
                    Confirm Password
                  </span>
                  <input
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                    style={{
                      background: `color-mix(in srgb, ${t.colors.background} 96%, white)`,
                      color: t.colors.text,
                      borderColor: matchErr ? 'rgba(220,38,38,0.5)' : 'rgba(0,0,0,0.18)',
                    }}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                  {matchErr && (
                    <span className="text-xs mt-1 block" style={{ color: '#c5221f' }}>{matchErr}</span>
                  )}
                </label>

                {err && (
                  <div className="rounded-lg text-sm p-3"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#c5221f', border: '1px solid rgba(220,38,38,0.2)' }}>
                    {err}{' '}
                    {(err.includes('expired') || err.includes('invalid') || err.includes('token')) && (
                      <Link href="/forgot-password" className="underline font-semibold" style={{ color: primary }}>
                        Request a new link
                      </Link>
                    )}
                  </div>
                )}

                <button
                  disabled={loading || !token}
                  className="w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: primary, color: '#fff' }}
                >
                  {loading ? 'Saving…' : 'Reset password'}
                </button>
              </form>
            )}

            <p className="text-sm text-center mt-6"
              style={{ color: `color-mix(in srgb, ${t.colors.text} 55%, transparent)` }}>
              <Link href={loginHref} className="font-semibold hover:underline" style={{ color: primary }}>
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
