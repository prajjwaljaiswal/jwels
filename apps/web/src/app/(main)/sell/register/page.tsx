'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';
import { GoogleButton } from '@/components/auth/GoogleButton';

export default function SellRegisterPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const data = await api<{ token: string; user: { role: string } }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...form, role: 'VENDOR' }),
        auth: false,
      });
      setToken(data.token);
      toast.success('Seller account created — let’s set up your shop.');
      router.push('/sell/onboard');
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
        body: JSON.stringify({ credential, role: 'VENDOR' }),
        auth: false,
      });
      setToken(data.token);
      toast.success('Welcome, seller!');
      router.push('/sell/onboard');
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }, [router]);

  const passOk = form.password.length >= 6;

  return (
    <div className="max-w-container mx-auto px-6 py-10 grid lg:grid-cols-2 gap-12 items-center">
      <div className="hidden lg:block">
        <div className="relative aspect-[5/6] rounded-md overflow-hidden bg-brand-50">
          <img
            src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=900&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <p className="font-display text-3xl text-white leading-tight">Open your jewelry shop.</p>
            <p className="text-white/80 text-sm mt-1">Flat 10% commission · Weekly payouts · KYC-verified marketplace.</p>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto">
        <div className="bg-surface border border-line rounded-md shadow-card p-7 md:p-9">
          <h1 className="font-display text-3xl text-ink-900">Become a seller</h1>
          <p className="text-sm text-ink-700 mt-1.5 mb-5">
            Already selling on Jewel?{' '}
            <Link href="/sell/login" className="text-brand-700 font-semibold hover:underline">
              Sign in
            </Link>
          </p>

          <GoogleButton text="signup_with" onCredential={onGoogle} disabled={loading} />

          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="text-xs uppercase tracking-wide text-ink-500">or with email</span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Full name</span>
              <input className="input-field" placeholder="Your name" autoComplete="name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Email</span>
              <input className="input-field" type="email" autoComplete="email" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Phone</span>
              <input className="input-field" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>
            <label className="block">
              <span className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase tracking-wide font-semibold text-ink-700">Password</span>
                <button type="button" onClick={() => setShowPass((s) => !s)} className="text-xs text-ink-500 hover:text-ink-900">
                  {showPass ? 'Hide' : 'Show'}
                </button>
              </span>
              <input className="input-field" type={showPass ? 'text' : 'password'} autoComplete="new-password"
                placeholder="At least 6 characters"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              {form.password.length > 0 && (
                <p className={`text-xs mt-1.5 ${passOk ? 'text-success' : 'text-ink-500'}`}>
                  {passOk ? '✓ Looks good' : `${6 - form.password.length} more character${6 - form.password.length === 1 ? '' : 's'} to go`}
                </p>
              )}
            </label>

            {err && <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">{err}</div>}

            <button disabled={loading} className="btn-primary w-full !py-3">
              {loading ? 'Creating account…' : 'Create seller account'}
            </button>
          </form>

          <p className="text-[11px] text-ink-500 text-center mt-5">
            By creating a seller account, you agree to Jewel's Seller Terms and Privacy Policy.
          </p>
        </div>

        <p className="text-xs text-ink-500 text-center mt-4">
          Want to buy instead? <Link href="/auth/register" className="text-brand-700 hover:underline">Create a shopper account</Link>
        </p>
      </div>
    </div>
  );
}
