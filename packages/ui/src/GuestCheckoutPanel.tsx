'use client';
import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';
import { useCart } from '@/lib/cart';

interface Props {
  onContinue: () => void;
}

function generatePassword(): string {
  // 16-char random password; the user can reset it from the receipt email later.
  const bytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(36)).join('').slice(0, 16) + 'A1!';
}

export function GuestCheckoutPanel({ onContinue }: Props) {
  const [mode, setMode] = useState<'choose' | 'guest' | 'login'>('choose');
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);

  async function continueAsGuest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const password = generatePassword();
      const data = await api<{ token: string; user: { role: string } }>('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ ...form, password, role: 'CUSTOMER' }),
      });
      setToken(data.token);
      await useCart.getState().mergeAndHydrate();
      toast.success("You're checking out as a guest. We'll email you a way to set a password.");
      onContinue();
    } catch {
      // toast already shown
    } finally {
      setBusy(false);
    }
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ token: string; user: { role: string } }>('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify(loginForm),
      });
      setToken(data.token);
      await useCart.getState().mergeAndHydrate();
      toast.success('Welcome back!');
      onContinue();
    } catch {
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-surface border border-line rounded-md shadow-card">
      <div className="px-5 py-4 border-b border-line">
        <h2 className="font-semibold text-ink-900">Sign in to continue</h2>
        <p className="text-xs text-ink-500 mt-0.5">Sign in for the fastest checkout, or continue as a guest.</p>
      </div>
      <div className="p-5">
        {mode === 'choose' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={() => setMode('login')} className="btn-secondary !py-4">I already have an account</button>
            <button onClick={() => setMode('guest')} className="btn-primary !py-4">Continue as guest</button>
          </div>
        )}

        {mode === 'guest' && (
          <form onSubmit={continueAsGuest} className="space-y-3">
            <p className="text-sm text-ink-700">
              We just need a few details to send you order updates. You can set a password from the email we send.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Name</span>
                <input className="input-field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Phone</span>
                <input className="input-field" required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Email</span>
              <input className="input-field" required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <div className="flex gap-2 pt-1">
              <button disabled={busy} className="btn-primary">{busy ? 'One moment…' : 'Continue to checkout'}</button>
              <button type="button" onClick={() => setMode('choose')} className="btn-secondary">Back</button>
            </div>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={doLogin} className="space-y-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Email</span>
              <input className="input-field" required type="email" autoComplete="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Password</span>
              <input className="input-field" required type="password" autoComplete="current-password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            </label>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex gap-2">
                <button disabled={busy} className="btn-primary">{busy ? 'Signing in…' : 'Sign in'}</button>
                <button type="button" onClick={() => setMode('choose')} className="btn-secondary">Back</button>
              </div>
              <Link href="/login?next=/checkout" className="text-xs text-ink-700 hover:underline">Full sign-in page →</Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
