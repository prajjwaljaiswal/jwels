'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useCart } from '@/lib/cart';

const PERKS = [
  'Discover handcrafted pieces from Indian jewelers',
  'Track every order in one place',
  'Hallmarked, certified, and shipped securely',
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function routeByRole(role: string) {
    if (next && next.startsWith('/')) { router.push(next); return; }
    if (role === 'ADMIN') {
      window.location.href = 'http://localhost:3002/';
    } else if (role === 'VENDOR') {
      window.location.href = 'http://localhost:3001/';
    } else {
      router.push('/products');
    }
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
      routeByRole(data.user.role);
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
      routeByRole(data.user.role);
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }, [router]); // eslint-disable-line

  return (
    <div className="max-w-container mx-auto px-6 py-10 grid lg:grid-cols-2 gap-12 items-center">
      {/* LEFT: brand panel */}
      <div className="hidden lg:block">
        <div className="relative aspect-[5/6] rounded-md overflow-hidden bg-brand-50">
          <img
            src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <p className="font-display text-3xl text-white leading-tight">
              Welcome back to Jewel.
            </p>
            <p className="text-white/80 text-sm mt-1">Your favorites are right where you left them.</p>
          </div>
        </div>
      </div>

      {/* RIGHT: form card */}
      <div className="max-w-md w-full mx-auto">
        <div className="bg-surface border border-line rounded-md shadow-card p-7 md:p-9">
          <h1 className="font-display text-3xl text-ink-900">Sign in</h1>
          <p className="text-sm text-ink-700 mt-1.5 mb-6">
            New to Jewel?{' '}
            <Link href="/auth/register" className="text-brand-700 font-semibold hover:underline">
              Create an account
            </Link>
          </p>

          <GoogleButton text="signin_with" onCredential={onGoogle} disabled={loading} />

          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="text-xs uppercase tracking-wide text-ink-500">or with email</span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Email</span>
              <input className="input-field" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block">
              <span className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase tracking-wide font-semibold text-ink-700">Password</span>
                <button type="button" onClick={() => setShowPass((s) => !s)} className="text-xs text-ink-500 hover:text-ink-900">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </span>
              <input className="input-field" type={showPass ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            {err && (
              <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">{err}</div>
            )}

            <button disabled={loading} className="btn-primary w-full !py-3">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-[11px] text-ink-500 text-center mt-5">
            By continuing, you agree to Jewel's Terms and Privacy Policy.
          </p>
        </div>

        <ul className="mt-6 space-y-2 px-1 lg:hidden">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2 text-xs text-ink-700">
              <span className="text-success">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
