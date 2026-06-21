'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { goToVendorDashboard } from '@/lib/vendor-handoff';

type Onboarding = {
  vendor: any;
  submitted: boolean;
  kycStatus: 'NOT_SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
  kycRejectionNote: string | null;
};

const NEXT_STEPS: [string, string][] = [
  ['We review your KYC and documents within 24–48 hours.', 'हम आपके KYC और दस्तावेज़ों की 24–48 घंटों में जाँच करते हैं।'],
  ['Once verified, you can start listing products.', 'सत्यापन होते ही आप प्रोडक्ट लिस्ट करना शुरू कर सकते हैं।'],
  ['Payouts run weekly to your registered bank account.', 'पेमेंट हर हफ़्ते आपके रजिस्टर्ड बैंक खाते में भेजा जाता है।'],
];

export default function OnboardReviewPage() {
  const { t } = useLang();
  const router = useRouter();
  const [s, setS] = useState<Onboarding | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const ob = await api<Onboarding>('/api/vendors/me/onboarding');
        if (!ob.submitted) { router.push('/sell/onboard'); return; }
        setS(ob);
      } catch (e: any) {
        if (e.message?.includes('Missing token')) router.push('/sell/login');
      }
    })();
  }, [router]);

  if (!s) return <div className="max-w-container mx-auto px-6 py-16"><div className="h-48 bg-surface border border-line rounded-md animate-pulse" /></div>;

  const rejected = s.kycStatus === 'REJECTED';
  const verified = s.kycStatus === 'VERIFIED';

  return (
    <div className="max-w-container mx-auto px-6 py-16">
      <div className="max-w-2xl mx-auto bg-surface border border-line rounded-md p-8 md:p-10 text-center">
        <div className={[
          'inline-flex h-14 w-14 rounded-full items-center justify-center mb-4',
          verified ? 'bg-green-50 text-success' : rejected ? 'bg-red-50 text-danger' : 'bg-amber-50 text-warn',
        ].join(' ')}>
          {verified ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6"/></svg>
          ) : rejected ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          )}
        </div>

        <h1 className="font-display text-3xl text-ink-900">
          {verified ? t('You\'re verified!', 'आप सत्यापित हो गए!') : rejected ? t('KYC was rejected', 'KYC अस्वीकृत कर दिया गया') : t('Under review', 'समीक्षा जारी है')}
        </h1>
        <p className="text-ink-700 mt-2 max-w-md mx-auto">
          {verified
            ? t('Your shop is approved and live. Start listing your pieces.', 'आपकी शॉप मंज़ूर होकर लाइव है। अपने प्रोडक्ट लिस्ट करना शुरू करें।')
            : rejected
              ? (s.kycRejectionNote || t('Please review and resubmit your details.', 'कृपया अपनी जानकारी जाँचकर दोबारा सबमिट करें।'))
              : `${t('Thanks for submitting', 'सबमिट करने के लिए धन्यवाद')} "${s.vendor.shopName}". ${t('We\'ll email you when review completes.', 'समीक्षा पूरी होने पर हम आपको ईमेल करेंगे।')}`}
        </p>

        {!rejected && !verified && (
          <ol className="mt-6 space-y-2 text-left max-w-md mx-auto">
            {NEXT_STEPS.map(([en, hi], i) => (
              <li key={i} className="flex gap-3 text-sm text-ink-700">
                <span className="h-6 w-6 shrink-0 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{t(en, hi)}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-7 flex items-center justify-center gap-3">
          {rejected ? (
            <Link href="/sell/onboard" className="btn-primary">{t('Update & resubmit', 'अपडेट करें और दोबारा सबमिट करें')}</Link>
          ) : (
            <button type="button" onClick={() => goToVendorDashboard('/')} className="btn-primary">{t('Go to dashboard', 'डैशबोर्ड पर जाएं')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
