'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useLang } from '@/lib/i18n';
import { goToVendorDashboard } from '@/lib/vendor-handoff';

export default function SellLoginPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { t } = useLang();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function routeSeller(role: string) {
    if (role !== 'VENDOR') {
      setErr(t('This isn’t a seller account. Create a seller account to sell on Vrindaonline.', 'यह विक्रेता खाता नहीं है। बेचने के लिए एक विक्रेता खाता बनाएं।'));
      try { setToken(null); } catch {}
      return;
    }
    try {
      const ob = await api<{ submitted: boolean; nextStep: number }>('/api/vendors/me/onboarding');
      if (!ob.submitted) { router.push('/sell/onboard'); return; }
      goToVendorDashboard('/'); // cross-origin: hand the session to the vendor dashboard
    } catch {
      router.push('/sell/onboard');
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
      toast.success(t('Welcome back!', 'वापसी पर स्वागत है!'));
      await routeSeller(data.user.role);
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
      toast.success(t('Welcome back!', 'वापसी पर स्वागत है!'));
      await routeSeller(data.user.role);
    } catch (e: any) {
      setErr(e.message);
      setLoading(false);
    }
  }, []); // eslint-disable-line

  return (
    <div className="max-w-container mx-auto px-6 py-10 grid lg:grid-cols-2 gap-12 items-center">
      <div className="hidden lg:block">
        <div className="relative aspect-[5/6] rounded-md overflow-hidden bg-brand-50">
          <img
            src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=900&q=80"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/60 to-transparent">
            <p className="font-display text-3xl text-white leading-tight">{t('Back to your shop.', 'अपनी दुकान पर वापस।')}</p>
            <p className="text-white/80 text-sm mt-1">{t('Manage orders, listings, and payouts.', 'ऑर्डर, लिस्टिंग और भुगतान प्रबंधित करें।')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto">
        <div className="bg-surface border border-line rounded-md shadow-card p-7 md:p-9">
          <h1 className="font-display text-3xl text-ink-900">{t('Seller sign in', 'विक्रेता साइन इन')}</h1>
          <p className="text-sm text-ink-700 mt-1.5 mb-6">
            {t('New to selling?', 'बेचने में नए हैं?')}{' '}
            <Link href="/sell/register" className="text-brand-700 font-semibold hover:underline">
              {t('Create a seller account', 'विक्रेता खाता बनाएं')}
            </Link>
          </p>

          <GoogleButton text="signin_with" onCredential={onGoogle} disabled={loading} />

          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="text-xs uppercase tracking-wide text-ink-500">{t('or with email', 'या ईमेल से')}</span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{t('Email', 'ईमेल')}</span>
              <input className="input-field" type="email" autoComplete="email" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block">
              <span className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase tracking-wide font-semibold text-ink-700">{t('Password', 'पासवर्ड')}</span>
                <button type="button" onClick={() => setShowPass((s) => !s)} className="text-xs text-ink-500 hover:text-ink-900">
                  {showPass ? t('Hide', 'छिपाएं') : t('Show', 'दिखाएं')}
                </button>
              </span>
              <input className="input-field" type={showPass ? 'text' : 'password'} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            {err && <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">{err}</div>}

            <button disabled={loading} className="btn-primary w-full !py-3">
              {loading ? t('Signing in…', 'साइन इन हो रहा है…') : t('Sign in to your shop', 'अपनी दुकान में साइन इन करें')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
