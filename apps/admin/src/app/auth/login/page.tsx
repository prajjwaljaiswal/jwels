'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';

export default function AdminLoginPage() {
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

      if (data.user.role !== 'ADMIN') {
        setErr('Access denied. This portal is for admins only.');
        setLoading(false);
        return;
      }

      setToken(data.token);
      toast.success('Welcome back!');
      router.push(next && next.startsWith('/') ? next : '/');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <span className="font-display text-3xl text-ink-900">Jewel</span>
          <p className="text-sm text-ink-500 mt-1">Operations console</p>
        </div>

        <div className="bg-surface border border-line rounded-md shadow-card p-7">
          <h1 className="font-display text-2xl text-ink-900 mb-1">Admin sign in</h1>
          <p className="text-sm text-ink-500 mb-6">
            Restricted to authorised Jewel staff only.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="form-label">Email</span>
              <input
                className="input-field"
                type="email"
                autoComplete="email"
                placeholder="admin@jewel.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="flex items-center justify-between mb-1.5">
                <span className="form-label !mb-0">Password</span>
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="text-xs text-ink-500 hover:text-ink-900"
                >
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </span>
              <input
                className="input-field"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {err && (
              <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">
                {err}
              </div>
            )}

            <button disabled={loading} className="btn-primary w-full !py-3">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-[11px] text-ink-500 text-center mt-5">
            By continuing, you agree to Jewel's Terms and Privacy Policy.
          </p>
        </div>

        <p className="text-center text-xs text-ink-500 mt-6">
          Default seed account: <span className="font-mono text-ink-700">admin@jewel.local / admin123</span>
        </p>
      </div>
    </div>
  );
}
