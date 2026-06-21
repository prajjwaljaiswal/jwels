'use client';
export const dynamic = 'force-dynamic';
import { Suspense, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { useLang } from '@/lib/i18n';

export default function SellRegisterPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { t } = useLang();
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
      toast.success(t('Seller account created — let’s set up your shop.', 'विक्रेता खाता बन गया — चलिए आपकी दुकान सेट करते हैं।'));
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
      toast.success(t('Welcome, seller!', 'स्वागत है, विक्रेता!'));
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
            <p className="font-display text-3xl text-white leading-tight">{t('Open your jewelry shop.', 'अपनी ज्वेलरी की दुकान खोलें।')}</p>
            <p className="text-white/80 text-sm mt-1">{t('Weekly payouts · KYC-verified marketplace.', 'साप्ताहिक भुगतान · KYC-सत्यापित मार्केटप्लेस।')}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto">
        <div className="bg-surface border border-line rounded-md shadow-card p-7 md:p-9">
          <h1 className="font-display text-3xl text-ink-900">{t('Become a seller', 'विक्रेता बनें')}</h1>
          <p className="text-sm text-ink-700 mt-1.5 mb-5">
            {t('Already selling on Vrindaonline?', 'पहले से Vrindaonline पर बेच रहे हैं?')}{' '}
            <Link href="/sell/login" className="text-brand-700 font-semibold hover:underline">
              {t('Sign in', 'साइन इन करें')}
            </Link>
          </p>

          <GoogleButton text="signup_with" onCredential={onGoogle} disabled={loading} />

          <div className="my-5 flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="text-xs uppercase tracking-wide text-ink-500">{t('or with email', 'या ईमेल से')}</span>
            <span className="flex-1 h-px bg-line" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{t('Full name', 'पूरा नाम')}</span>
              <input className="input-field" placeholder={t('Your name', 'आपका नाम')} autoComplete="name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{t('Email', 'ईमेल')}</span>
              <input className="input-field" type="email" autoComplete="email" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{t('Phone', 'फ़ोन')}</span>
              <input className="input-field" inputMode="numeric" autoComplete="tel" placeholder={t('10-digit mobile', '10 अंकों का मोबाइल')}
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </label>
            <label className="block">
              <span className="flex items-center justify-between mb-1.5">
                <span className="text-xs uppercase tracking-wide font-semibold text-ink-700">{t('Password', 'पासवर्ड')}</span>
                <button type="button" onClick={() => setShowPass((s) => !s)} className="text-xs text-ink-500 hover:text-ink-900">
                  {showPass ? t('Hide', 'छिपाएँ') : t('Show', 'दिखाएँ')}
                </button>
              </span>
              <input className="input-field" type={showPass ? 'text' : 'password'} autoComplete="new-password"
                placeholder={t('At least 6 characters', 'कम से कम 6 अक्षर')}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              {form.password.length > 0 && (
                <p className={`text-xs mt-1.5 ${passOk ? 'text-success' : 'text-ink-500'}`}>
                  {passOk ? t('✓ Looks good', '✓ सही है') : `${6 - form.password.length} ${6 - form.password.length === 1 ? t('more character to go', 'और अक्षर चाहिए') : t('more characters to go', 'और अक्षर चाहिए')}`}
                </p>
              )}
            </label>

            {err && <div className="rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3">{err}</div>}

            <button disabled={loading} className="btn-primary w-full !py-3">
              {loading ? t('Creating account…', 'खाता बन रहा है…') : t('Create seller account', 'विक्रेता खाता बनाएँ')}
            </button>
          </form>

          <p className="text-[11px] text-ink-500 text-center mt-5">
            {t("By creating a seller account, you agree to Vrindaonline's Seller Terms and Privacy Policy.", 'विक्रेता खाता बनाकर, आप Vrindaonline की विक्रेता शर्तों और गोपनीयता नीति से सहमत होते हैं।')}
          </p>
        </div>
      </div>
    </div>
  );
}
