'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';

export default function SellLandingPage() {
  const { t } = useLang();

  const PERKS = [
    { title: t('Reach jewelry lovers', 'गहनों के शौकीनों तक पहुँचें'), body: t('List your handcrafted pieces in front of buyers actively shopping for unique jewelry.', 'अपने हाथ से बने गहने उन खरीदारों के सामने रखें जो खास गहने ढूँढ रहे हैं।') },
    { title: t('Free to list', 'लिस्टिंग मुफ़्त'), body: t('No listing fees, no monthly subscriptions. Open your shop and start selling for free.', 'कोई लिस्टिंग शुल्क नहीं, कोई मासिक सदस्यता नहीं। अपनी दुकान खोलें और मुफ़्त में बेचना शुरू करें।') },
    { title: t('Weekly payouts', 'साप्ताहिक भुगतान'), body: t('Earnings settle to your bank account every week once orders are delivered.', 'ऑर्डर डिलीवर होने के बाद आपकी कमाई हर हफ़्ते आपके बैंक खाते में पहुँच जाती है।') },
    { title: t('Branded storefront', 'अपने ब्रांड की दुकान'), body: t('Your own logo, banner, theme, and shop URL on Vrindaonline.', 'Vrindaonline पर आपका अपना लोगो, बैनर, थीम और शॉप URL।') },
  ];

  const STEPS = [
    t('Create your seller account in under a minute.', 'एक मिनट से भी कम में अपना सेलर अकाउंट बनाएँ।'),
    t('Complete a 6-step onboarding: shop, business, bank, pickup, branding, ID.', '6 चरणों की ऑनबोर्डिंग पूरी करें: दुकान, व्यवसाय, बैंक, पिकअप, ब्रांडिंग, पहचान।'),
    t('Our team reviews your KYC within 24–48 hours.', 'हमारी टीम 24–48 घंटों में आपका KYC जाँच लेती है।'),
    t('Start listing and selling — payouts run weekly.', 'लिस्टिंग और बिक्री शुरू करें — भुगतान हर हफ़्ते होते हैं।'),
  ];

  return (
    <div className="max-w-container mx-auto px-6">
      {/* Hero */}
      <section className="py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-700 font-semibold mb-3">{t('Sell on Vrindaonline', 'Vrindaonline पर बेचें')}</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink-900 leading-tight">
            {t('Turn your craft into a thriving jewelry shop.', 'अपने हुनर को एक चलती-फिरती ज्वेलरी दुकान में बदलें।')}
          </h1>
          <p className="text-ink-700 mt-4 max-w-lg">
            {t('Join independent jewelers across India selling on Vrindaonline. Open your shop, list your pieces, and reach buyers who love handcrafted, hallmarked jewelry.', 'पूरे भारत के स्वतंत्र ज्वेलर्स के साथ Vrindaonline पर जुड़ें। अपनी दुकान खोलें, अपने गहने लिस्ट करें, और उन खरीदारों तक पहुँचें जिन्हें हाथ से बने, हॉलमार्क वाले गहने पसंद हैं।')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/sell/register" className="btn-primary !py-3 !px-6">{t('Start selling', 'बेचना शुरू करें')}</Link>
            <Link href="/sell/login" className="btn-secondary !py-3 !px-6">{t('Sign in to your shop', 'अपनी दुकान में साइन इन करें')}</Link>
          </div>
          <p className="text-xs text-ink-500 mt-3">{t('No setup fees · No listing fees · Weekly payouts', 'कोई सेटअप शुल्क नहीं · कोई लिस्टिंग शुल्क नहीं · साप्ताहिक भुगतान')}</p>
        </div>
        <div className="relative aspect-[5/6] rounded-md overflow-hidden bg-brand-50">
          <img
            src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=900&q=80"
            alt={t('Independent jewelry seller at her bench', 'अपनी वर्कबेंच पर काम करती एक स्वतंत्र ज्वेलरी विक्रेता')}
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Perks */}
      <section className="py-12 border-t border-line">
        <h2 className="font-display text-3xl text-ink-900 mb-8">{t('Why sell on Vrindaonline', 'Vrindaonline पर क्यों बेचें')}</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {PERKS.map((p) => (
            <div key={p.title} className="bg-surface border border-line rounded-md p-6">
              <h3 className="font-semibold text-ink-900">{p.title}</h3>
              <p className="text-sm text-ink-700 mt-1.5">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 border-t border-line">
        <h2 className="font-display text-3xl text-ink-900 mb-8">{t('How it works', 'यह कैसे काम करता है')}</h2>
        <ol className="grid md:grid-cols-4 gap-6">
          {STEPS.map((s, i) => (
            <li key={i} className="bg-surface border border-line rounded-md p-6">
              <div className="h-8 w-8 rounded-full bg-brand-50 text-brand-700 font-bold text-sm flex items-center justify-center mb-3">
                {i + 1}
              </div>
              <p className="text-sm text-ink-700">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <h2 className="font-display text-3xl text-ink-900">{t('Ready to open your shop?', 'अपनी दुकान खोलने के लिए तैयार हैं?')}</h2>
        <p className="text-ink-700 mt-2">{t("A few details and you're on your way.", 'बस कुछ जानकारी और आप तैयार हैं।')}</p>
        <Link href="/sell/register" className="btn-primary !py-3 !px-8 mt-5 inline-block">{t('Start selling', 'बेचना शुरू करें')}</Link>
      </section>
    </div>
  );
}
