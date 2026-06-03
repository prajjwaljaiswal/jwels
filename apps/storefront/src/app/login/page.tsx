'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useCart } from '@/lib/cart';
import { defaultTheme, type VendorBrand, type VendorTheme } from '@/lib/vendor-context';
import { StorefrontHeader } from '@/components/auth/StorefrontHeader';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginInner />
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

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '';

  // Extract vendor slug from the ?next path (e.g. /my-shop/orders → my-shop)
  const vendorKey = next.startsWith('/') ? next.split('/')[1] : '';

  const [vendor, setVendor] = useState<VendorBrand | null>(null);
  const [themeConfig, setThemeConfig] = useState<VendorTheme>(defaultTheme());
  const [themeReady, setThemeReady] = useState(!vendorKey);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

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

  function routeAfterLogin(role: string) {
    if (next && next.startsWith('/')) { router.push(next); return; }
    if (role === 'ADMIN')  { window.location.href = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002/'; return; }
    if (role === 'VENDOR') { window.location.href = process.env.NEXT_PUBLIC_VENDOR_URL || 'http://localhost:3001/'; return; }
    router.push(vendorKey ? `/${vendorKey}` : '/');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = await api<{ token: string; user: { role: string } }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        auth: false,
      });
      setToken(data.token);
      await useCart.getState().mergeAndHydrate();
      toast.success('Welcome back!');
      routeAfterLogin(data.user.role);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const onGoogle = useCallback(async (credential: string) => {
    setErr('');
    setLoading(true);
    try {
      const data = await api<{ token: string; user: { role: string } }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential }),
        auth: false,
      });
      setToken(data.token);
      await useCart.getState().mergeAndHydrate();
      toast.success('Welcome back!');
      routeAfterLogin(data.user.role);
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }, [next, vendorKey]); // eslint-disable-line

  const t = themeConfig;
  const primary = t.colors.primary;
  // CSS variables matching the vendor's storefront palette
  const cssVars: React.CSSProperties & Record<string, string> = {
    '--store-color':  primary,
    '--store-bg':     t.colors.background,
    '--store-text':   t.colors.text,
    '--store-header-bg':   t.colors.headerBg,
    '--store-header-text': t.colors.headerText,
    background: t.colors.background,
    color: t.colors.text,
    minHeight: '100vh',
  };

  if (!themeReady) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="h-16 border-b border-line bg-surface animate-pulse" />
        <div className="flex items-center justify-center py-24">
          <div className="w-full max-w-md h-96 rounded-2xl bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div style={cssVars} className="flex flex-col">
      <StorefrontHeader vendor={vendor} themeConfig={t} vendorKey={vendorKey} />

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl shadow-pop p-7 md:p-9"
            style={{ background: t.colors.background, border: '1px solid rgba(0,0,0,0.10)' }}
          >
            <h1 className="font-display text-3xl mb-1" style={{ color: t.colors.text }}>Sign in</h1>
            <p className="text-sm mb-6" style={{ color: `color-mix(in srgb, ${t.colors.text} 65%, transparent)` }}>
              Don't have an account?{' '}
              <Link
                href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="font-semibold hover:underline"
                style={{ color: primary }}
              >
                Register
              </Link>
            </p>

            <GoogleButton text="signin_with" onCredential={onGoogle} disabled={loading} />

            <div className="my-5 flex items-center gap-3">
              <span className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.12)' }} />
              <span className="text-xs uppercase tracking-wide" style={{ color: `color-mix(in srgb, ${t.colors.text} 50%, transparent)` }}>
                or with email
              </span>
              <span className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.12)' }} />
            </div>

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
                  type="email" autoComplete="email" placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </label>

              <label className="block">
                <span className="flex items-center justify-between mb-1.5">
                  <span className="text-xs uppercase tracking-wide font-semibold"
                    style={{ color: `color-mix(in srgb, ${t.colors.text} 70%, transparent)` }}>
                    Password
                  </span>
                  <span className="flex items-center gap-3">
                    <Link
                      href={`/forgot-password${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                      className="text-xs hover:underline"
                      style={{ color: primary }}
                    >
                      Forgot password?
                    </Link>
                    <button type="button" onClick={() => setShowPass((s) => !s)}
                      className="text-xs hover:underline"
                      style={{ color: `color-mix(in srgb, ${t.colors.text} 55%, transparent)` }}>
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </span>
                </span>
                <input
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition"
                  style={{
                    background: `color-mix(in srgb, ${t.colors.background} 96%, white)`,
                    color: t.colors.text,
                    borderColor: 'rgba(0,0,0,0.18)',
                  }}
                  type={showPass ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
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
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-[11px] text-center mt-5"
              style={{ color: `color-mix(in srgb, ${t.colors.text} 45%, transparent)` }}>
              By continuing, you agree to Jewel's Terms and Privacy Policy.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
