'use client';
import Link from 'next/link';
import { Reveal } from '@/components/landing/Reveal';
import { Marquee } from '@/components/landing/Marquee';
import { MagneticButton } from '@/components/landing/MagneticButton';
import { SparkleCanvas } from '@/components/landing/SparkleCanvas';
import { Parallax } from '@/components/landing/Parallax';
import { CursorSpotlight } from '@/components/landing/CursorSpotlight';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { Logo } from '@/components/brand/Logo';
import { StickyCta } from '@/components/landing/StickyCta';
import { TiltCard } from '@/components/landing/TiltCard';
import { FAQAccordion } from '@/components/landing/FAQAccordion';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLang } from '@/lib/i18n';

// Vendor-acquisition landing. Bilingual (EN/हिं) via the site-wide language context;
// the toggle lives in the header. Shoppers buy on each vendor's own storefront — there
// is no central consumer catalogue here.

type Bi = { en: string; hi: string };

// Decorative tickers stay as-is (atmospheric / proper nouns).
const TICKER = [
  '✦ FREE TO LIST · 10% ONLY WHEN YOU SELL', '✦ WEEKLY PAYOUTS VIA RAZORPAY',
  '✦ YOUR OWN BRANDED STORE & DOMAIN', '✦ GST-READY INVOICING',
  '✦ PRE-PRINTED SHIPPING LABELS', '✦ MADE IN INDIA, BY INDEPENDENT ARTISANS',
];
const VENDOR_TICKER = [
  'Goldsmiths of Jaipur', 'Silversmiths of Cuttack', 'Kundan ateliers', 'Temple-jewellery makers',
  'Meenakari studios', 'Filigree workshops', 'Polki specialists', 'Pearl designers',
  'Tribal-silver artisans', 'Contemporary studios',
];
const HERO_STACK = [
  { src: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80', alt: 'Layered gold necklace', tilt: '-rotate-3', pos: 'top-0 left-4 z-30' },
  { src: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=700&q=80', alt: 'Pearl drop earrings', tilt: 'rotate-6', pos: 'top-16 right-0 z-20' },
  { src: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=700&q=80', alt: 'Solitaire ring', tilt: '-rotate-6', pos: 'bottom-0 left-0 z-10' },
];

const PILLARS: { title: string; suffix: string; label: Bi }[] = [
  { title: '₹0', suffix: '', label: { en: 'No listing fee — open your shop free.', hi: 'कोई लिस्टिंग फ़ीस नहीं — स्टोर मुफ़्त खोलें।' } },
  { title: '24', suffix: 'h', label: { en: 'KYC review — go live in under a day.', hi: 'KYC समीक्षा — एक दिन में लाइव।' } },
  { title: '7', suffix: 'd', label: { en: 'Weekly direct payouts to your bank.', hi: 'हर हफ़्ते सीधे आपके बैंक में भुगतान।' } },
  { title: '10', suffix: '%', label: { en: 'Flat commission — only when you sell.', hi: 'फ़्लैट कमीशन — सिर्फ़ बिक्री पर।' } },
];

const SELLER_STEPS: { n: string; t: Bi; d: Bi }[] = [
  { n: '01', t: { en: 'Open your shop in minutes', hi: 'कुछ मिनटों में अपना स्टोर खोलें' },
    d: { en: 'Sign up and complete a short KYC. List your products, photos and prices — no signup fee, no monthly bill.', hi: 'साइन अप करें और छोटी KYC पूरी करें। अपने प्रोडक्ट्स, फ़ोटो और दाम लिस्ट करें — कोई साइनअप फ़ीस नहीं, कोई मासिक बिल नहीं।' } },
  { n: '02', t: { en: 'Get your own storefront', hi: 'अपना खुद का स्टोरफ्रंट पाएं' },
    d: { en: 'A branded store with your logo, theme and a web address that’s truly yours: yourshop.store.vrindaonline.com, or connect your own domain.', hi: 'आपके लोगो, थीम और एक वेब एड्रेस के साथ ब्रांडेड स्टोर जो सच में आपका हो: yourshop.store.vrindaonline.com, या अपना डोमेन जोड़ें।' } },
  { n: '03', t: { en: 'Sell and get paid weekly', hi: 'बेचें और हर हफ़्ते भुगतान पाएं' },
    d: { en: 'Manage every order from one dashboard. Direct bank payouts every week for delivered orders — no delays, no minimums.', hi: 'हर ऑर्डर एक डैशबोर्ड से संभालें। डिलीवर हुए ऑर्डर का भुगतान हर हफ़्ते सीधे बैंक में — कोई देरी नहीं, कोई न्यूनतम नहीं।' } },
];

const PROMISES: { eyebrow: Bi; title: Bi; body: Bi }[] = [
  { eyebrow: { en: 'To you', hi: 'आपके लिए' }, title: { en: 'You keep what you earn.', hi: 'जो कमाएं, वही रखें।' },
    body: { en: 'No listing fees. No monthly subscriptions. No setup cost. A flat 10% only when you make a sale, and weekly payouts direct to your bank.', hi: 'कोई लिस्टिंग फ़ीस नहीं। कोई मासिक सब्सक्रिप्शन नहीं। कोई सेटअप कॉस्ट नहीं। बिक्री होने पर फ़्लैट 10%, और हर हफ़्ते सीधे बैंक में भुगतान।' } },
  { eyebrow: { en: 'To your store', hi: 'आपके स्टोर के लिए' }, title: { en: 'A storefront that’s yours.', hi: 'एक स्टोरफ्रंट जो आपका है।' },
    body: { en: 'Your name, your colours, your logo, your domain. Customers shop your boutique — not a generic listing buried in someone else’s catalogue.', hi: 'आपका नाम, आपके रंग, आपका लोगो, आपका डोमेन। ग्राहक आपकी बुटीक से खरीदते हैं — किसी और के कैटलॉग में दबी आम लिस्टिंग से नहीं।' } },
  { eyebrow: { en: 'To the craft', hi: 'हुनर के लिए' }, title: { en: 'A stage, not a sweatshop.', hi: 'एक मंच, शोषण नहीं।' },
    body: { en: 'We onboard independent makers — not resellers, not factories. Every shop has a real name, a real city, and a real story behind the work.', hi: 'हम स्वतंत्र मेकर्स को जोड़ते हैं — रीसेलर्स नहीं, फ़ैक्ट्रियां नहीं। हर स्टोर का एक असली नाम, असली शहर, और काम के पीछे एक असली कहानी है।' } },
];

const FAQS: { q: Bi; a: Bi }[] = [
  { q: { en: 'How much does it cost to sell on Vrindaonline?', hi: 'Vrindaonline पर बेचने में कितना खर्च आता है?' },
    a: { en: 'Zero to start. There’s no listing fee, no monthly subscription, and no annual contract. You pay a flat 10% commission only when you make a sale.', hi: 'शुरू करना बिलकुल मुफ़्त। कोई लिस्टिंग फ़ीस नहीं, कोई मासिक सब्सक्रिप्शन नहीं, कोई सालाना कॉन्ट्रैक्ट नहीं। बिक्री होने पर सिर्फ़ फ़्लैट 10% कमीशन।' } },
  { q: { en: 'How and when do I get paid?', hi: 'मुझे भुगतान कैसे और कब मिलता है?' },
    a: { en: 'Payouts run every week through Razorpay, direct to your bank account. We provide GST-ready invoicing with the right HSN and tax breakup. Every transaction is visible in your payouts dashboard.', hi: 'भुगतान हर हफ़्ते Razorpay के ज़रिए सीधे आपके बैंक खाते में। हम सही HSN और टैक्स ब्रेकअप के साथ GST-तैयार इनवॉइसिंग देते हैं। हर ट्रांज़ैक्शन आपके पेआउट डैशबोर्ड में दिखता है।' } },
  { q: { en: 'Do I get my own web address?', hi: 'क्या मुझे अपना वेब एड्रेस मिलता है?' },
    a: { en: 'Yes. Every shop gets a branded address like yourshop.store.vrindaonline.com instantly, and you can connect a custom domain you own (e.g. yourbrand.com) — we set up the SSL certificate for you.', hi: 'हाँ। हर स्टोर को तुरंत एक ब्रांडेड एड्रेस मिलता है जैसे yourshop.store.vrindaonline.com, और आप अपना कस्टम डोमेन (जैसे yourbrand.com) जोड़ सकते हैं — SSL सर्टिफ़िकेट हम सेट कर देते हैं।' } },
  { q: { en: 'Who handles shipping and returns?', hi: 'शिपिंग और रिटर्न कौन संभालता है?' },
    a: { en: 'You ship the product; we provide pre-printed labels and integrations with Delhivery, BlueDart and India Post. If a buyer returns within 30 days, we help coordinate the pickup and refund so you don’t chase couriers.', hi: 'प्रोडक्ट आप भेजते हैं; हम रेडीमेड लेबल और Delhivery, BlueDart, India Post के इंटीग्रेशन देते हैं। अगर खरीदार 30 दिनों में रिटर्न करता है, तो पिकअप और रिफ़ंड में हम मदद करते हैं ताकि आपको कूरियर के पीछे न भागना पड़े।' } },
  { q: { en: 'Do I need GST registration to sell?', hi: 'क्या बेचने के लिए GST रजिस्ट्रेशन ज़रूरी है?' },
    a: { en: 'You can start without GST if your annual turnover is under ₹40 lakh. Above that, GST registration is required by law. We provide GST-ready invoicing either way.', hi: 'अगर आपका सालाना टर्नओवर ₹40 लाख से कम है तो आप बिना GST के शुरू कर सकते हैं। उससे ऊपर, कानूनन GST रजिस्ट्रेशन ज़रूरी है। दोनों ही स्थिति में हम GST-तैयार इनवॉइसिंग देते हैं।' } },
];

export default function VendorLandingPage() {
  const { lang, t } = useLang();
  const L = (o: Bi) => o[lang];
  // FAQAccordion expects { q, a } strings — resolve per language.
  const faqItems = FAQS.map((f) => ({ q: L(f.q), a: L(f.a) }));

  return (
    <div className="bg-canvas overflow-hidden">
      <ScrollProgress />
      <StickyCta />

      {/* ============= HERO ============= */}
      <CursorSpotlight>
        <section className="relative isolate min-h-[92vh]">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#FFF6EC] via-canvas to-canvas" />
          <div className="absolute -top-40 -right-32 -z-10 h-[640px] w-[640px] rounded-full glow-warm animate-aurora" />
          <div className="absolute top-32 -left-40 -z-10 h-[520px] w-[520px] rounded-full glow-gold animate-aurora-2" />
          <div className="absolute inset-0 -z-10 pointer-events-none"><SparkleCanvas density={75} /></div>
          <div className="absolute inset-0 -z-10 opacity-[0.06] pointer-events-none" style={{
            backgroundImage: 'linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7), rgba(0,0,0,0) 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7), rgba(0,0,0,0) 70%)',
          }} />

          {/* inline header */}
          <div className="absolute top-5 sm:top-6 left-0 right-0 z-20">
            <div className="max-w-container mx-auto px-4 sm:px-6 flex items-center justify-between gap-2">
              <Logo textClassName="font-display text-2xl sm:text-3xl text-brand-600 leading-none drop-shadow-sm" />
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <Link href="/sell/login" className="hidden sm:inline text-sm font-medium text-ink-900 hover:text-brand-700 transition-colors px-3 py-2">
                  {t('Log in', 'लॉग इन')}
                </Link>
                <Link href="/sell/register" className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold rounded-pill bg-brand-600 text-white px-3.5 sm:px-4 py-2 hover:bg-brand-700 transition whitespace-nowrap">
                  {t('Start selling', 'बेचना शुरू करें')}
                </Link>
                <LanguageToggle />
              </div>
            </div>
          </div>

          <div className="max-w-container mx-auto px-6 pt-28 md:pt-32 pb-24 md:pb-32 grid md:grid-cols-12 gap-10 md:gap-14 items-center">
            <div className="md:col-span-7 relative">
              <span className="inline-flex items-center gap-2 rounded-pill glass border border-line px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 shadow-card">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-glow" />
                {t('Now onboarding our founding artisans', 'अभी हमारे शुरुआती कारीगरों को जोड़ रहे हैं')}
              </span>

              <h1
                className="font-display text-5xl sm:text-6xl md:text-[5.25rem] leading-[1.04] text-ink-900 mt-6 tracking-tight fade-up-load"
                dangerouslySetInnerHTML={{ __html: t(
                  'Open your own <span class="text-gradient-warm italic">jewellery</span> store.',
                  'अपना खुद का <span class="text-gradient-warm italic">ज्वेलरी</span> स्टोर खोलें।',
                ) }}
              />

              <p className="text-lg text-ink-700 max-w-xl mt-6 fade-up-load" style={{ animationDelay: '120ms' }}
                dangerouslySetInnerHTML={{ __html: t(
                  'Sell your handcrafted jewellery from a store that’s truly yours — your brand, your domain, <span class="text-ink-900 font-medium">fair payouts, zero middlemen.</span> Free to start, 10% only when you sell.',
                  'अपनी हस्तनिर्मित ज्वेलरी एक ऐसे स्टोर से बेचें जो सच में आपका हो — आपका ब्रांड, आपका डोमेन, <span class="text-ink-900 font-medium">उचित भुगतान, कोई बिचौलिया नहीं।</span> शुरू करना मुफ़्त, 10% सिर्फ़ बिक्री पर।',
                ) }}
              />

              <div className="flex flex-wrap items-center gap-3 mt-9 fade-up-load" style={{ animationDelay: '240ms' }}>
                <MagneticButton href="/sell/register" variant="primary">
                  {t('Open your shop — free', 'अपना स्टोर खोलें — मुफ़्त')}
                  <ArrowRight />
                </MagneticButton>
                <MagneticButton href="/how-it-works" variant="secondary">
                  {t('How it works', 'कैसे काम करता है')}
                  <Sparkle />
                </MagneticButton>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 fade-up-load" style={{ animationDelay: '360ms' }}>
                <TrustBadge icon={<ShieldCheck />} label={t('Weekly Razorpay payouts', 'हर हफ़्ते Razorpay पेआउट')} />
                <TrustBadge icon={<Award />} label={t('GST-ready invoicing', 'GST-तैयार इनवॉइसिंग')} />
                <TrustBadge icon={<Truck />} label={t('Pre-printed shipping labels', 'रेडीमेड शिपिंग लेबल')} />
              </div>
            </div>

            <div className="md:col-span-5 relative h-[520px] md:h-[600px]">
              {HERO_STACK.map((s, i) => (
                <div key={i} className={`absolute ${s.pos} w-[68%] aspect-[3/4] ${s.tilt} ${i === 0 ? 'animate-float-slow' : i === 1 ? 'animate-float' : 'animate-bob'}`}>
                  <TiltCard max={9}>
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-pop ring-1 ring-white/60">
                      <img src={s.src} alt={s.alt} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                    </div>
                  </TiltCard>
                </div>
              ))}

              <div className="hidden md:flex absolute -bottom-2 left-2 z-40 items-center gap-3 bg-white rounded-pill shadow-pop pl-2 pr-5 py-2 animate-bob">
                <span className="h-9 w-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center"><Sparkle /></span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-ink-500 font-semibold">{t('For artisans', 'कारीगरों के लिए')}</p>
                  <p className="text-sm font-semibold text-ink-900 -mt-0.5">{t('Free to list · 10% only when you sell', 'लिस्ट करना मुफ़्त · 10% सिर्फ़ बिक्री पर')}</p>
                </div>
              </div>

              <div className="absolute top-2 -left-2 z-40 hidden md:flex items-center gap-2 bg-ink-900 text-white rounded-pill px-3.5 py-2 text-xs shadow-pop animate-float">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-medium">{t('Founding-vendor sign-ups open', 'शुरुआती विक्रेता रजिस्ट्रेशन खुला है')}</span>
              </div>
            </div>
          </div>
        </section>
      </CursorSpotlight>

      {/* ============= TICKER ============= */}
      <section className="bg-ink-900 text-white py-5 border-y border-ink-700/40">
        <Marquee speed="normal">
          {TICKER.map((x) => (<span key={x} className="px-8 text-sm font-medium tracking-[0.2em] uppercase whitespace-nowrap">{x}</span>))}
        </Marquee>
      </section>

      {/* ============= PILLARS ============= */}
      <section className="max-w-container mx-auto px-6 py-20 md:py-28">
        <Reveal as="div" className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">
            {t('Why sell on Vrindaonline', 'Vrindaonline पर क्यों बेचें')}
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-ink-900" dangerouslySetInnerHTML={{ __html: t(
            'A fairer platform for <span class="text-gradient-warm italic">makers</span> of beautiful things.',
            'खूबसूरत चीज़ें बनाने वालों के लिए एक बेहतर <span class="text-gradient-warm italic">प्लेटफ़ॉर्म</span>।',
          ) }} />
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-6">
          {PILLARS.map((p, i) => (
            <Reveal key={i} delay={i * 120} className="text-center md:border-r md:last:border-r-0 border-line">
              <div className="font-display text-5xl md:text-6xl text-ink-900 leading-none">
                {p.title}<span className="text-3xl md:text-4xl align-top ml-1 text-brand-700">{p.suffix}</span>
              </div>
              <p className="text-sm text-ink-700 mt-3 max-w-[14rem] mx-auto">{L(p.label)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============= HOW SELLING WORKS ============= */}
      <section id="how" className="relative bg-ink-900 text-white scroll-mt-10">
        <div className="absolute inset-0 pointer-events-none opacity-30 animate-pan" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(241,100,30,0.55), transparent 45%), radial-gradient(circle at 80% 80%, rgba(232,163,61,0.45), transparent 50%)',
          backgroundSize: '200% 200%',
        }} />
        <div className="max-w-container mx-auto px-6 py-20 md:py-28 relative">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.2em] text-[#FFC58A] font-semibold mb-3 inline-block">{t('How it works', 'कैसे काम करता है')}</p>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05] mb-4 max-w-2xl">{t('Three steps to your own jewellery store.', 'अपने खुद के ज्वेलरी स्टोर तक तीन कदम।')}</h2>
            <p className="text-white/70 max-w-xl">{t('Free to start, free to stay. No monthly bill, no listing fee, no contract — we make money only when you do.', 'शुरू करना मुफ़्त, चलाना मुफ़्त। कोई मासिक बिल नहीं, कोई लिस्टिंग फ़ीस नहीं, कोई कॉन्ट्रैक्ट नहीं — हम तभी कमाते हैं जब आप कमाते हैं।')}</p>
          </Reveal>
          <ol className="mt-12 grid md:grid-cols-3 gap-6">
            {SELLER_STEPS.map((s, i) => (
              <Reveal key={s.n} delay={140 + i * 120} className="bg-white/5 border border-white/10 rounded-2xl p-7">
                <span className="step-number">{s.n}</span>
                <h4 className="font-semibold text-lg mt-4">{L(s.t)}</h4>
                <p className="text-sm text-white/70 mt-2">{L(s.d)}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={500} className="mt-10">
            <Link href="/sell/register" className="inline-flex items-center justify-center bg-white text-ink-900 font-semibold rounded-pill px-7 py-3.5 transition hover:bg-brand-600 hover:text-white gap-2">
              {t('Start selling', 'बेचना शुरू करें')}
              <ArrowRight />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ============= BUILT FOR ARTISANS ============= */}
      <section className="relative bg-canvas py-24 md:py-32 overflow-hidden">
        <div className="max-w-container mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <Reveal direction="left" className="md:col-span-6 relative h-[520px] md:h-[640px]">
            <Parallax speed={0.18} className="h-full">
              <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-pop">
                <img src="/jwels.avif" alt="Artisan shaping a piece of jewellery by hand in a warm workshop setting with tools visible" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-tr from-ink-900/55 via-transparent to-transparent" />
              </div>
            </Parallax>
            <Parallax speed={-0.12} className="absolute -bottom-6 -right-6 md:-right-10">
              <div className="bg-white rounded-2xl shadow-pop p-5 max-w-[280px]">
                <div className="flex items-center gap-2 text-brand-700 mb-2">
                  <Sparkle /><span className="text-[10px] uppercase tracking-[0.18em] font-semibold">{t('Founder’s note', 'संस्थापक की बात')}</span>
                </div>
                <p className="text-xs text-ink-700 leading-relaxed">{t(
                  '“We built Vrindaonline because India’s independent jewellery makers deserve better than 30% cuts and pay-to-play listings.”',
                  '“हमने Vrindaonline इसलिए बनाया क्योंकि भारत के स्वतंत्र ज्वेलरी मेकर्स 30% कटौती और पैसे देकर लिस्टिंग से बेहतर के हक़दार हैं।”',
                )}</p>
                <p className="text-xs font-semibold text-ink-900 mt-2">{t('— The Vrindaonline team', '— Vrindaonline टीम')}</p>
              </div>
            </Parallax>
          </Reveal>

          <div className="md:col-span-6 md:pl-6">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">{t('Built for artisans', 'कारीगरों के लिए बना')}</p>
              <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.05] mb-6" dangerouslySetInnerHTML={{ __html: t(
                'Real makers. <br /><span class="text-gradient-warm italic">Fair economics.</span>',
                'असली मेकर्स। <br /><span class="text-gradient-warm italic">उचित अर्थशास्त्र।</span>',
              ) }} />
            </Reveal>
            <Reveal delay={150}>
              <p className="text-lg text-ink-700 mb-6 max-w-lg">{t(
                'Behind every shop on Vrindaonline is a person — a goldsmith in Jaipur, a silversmith in Cuttack, a designer in Bandra. Our job is to give them a storefront, not to tax their craft.',
                'Vrindaonline के हर स्टोर के पीछे एक इंसान है — जयपुर का सुनार, कटक का चांदी-कारीगर, बांद्रा का डिज़ाइनर। हमारा काम उन्हें एक स्टोरफ्रंट देना है, उनके हुनर पर टैक्स लगाना नहीं।',
              )}</p>
            </Reveal>
            <Reveal delay={300}>
              <ul className="space-y-3 mb-8">
                {[
                  { en: 'Your own branded store on a subdomain or custom domain', hi: 'सबडोमेन या कस्टम डोमेन पर आपका अपना ब्रांडेड स्टोर' },
                  { en: 'Weekly Razorpay payouts — direct, no minimum threshold', hi: 'हर हफ़्ते Razorpay पेआउट — सीधे, कोई न्यूनतम सीमा नहीं' },
                  { en: 'GST-ready invoicing with correct HSN and tax breakup', hi: 'सही HSN और टैक्स ब्रेकअप के साथ GST-तैयार इनवॉइसिंग' },
                  { en: 'Pre-printed shipping labels (Delhivery · BlueDart · India Post)', hi: 'रेडीमेड शिपिंग लेबल (Delhivery · BlueDart · India Post)' },
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-ink-900">
                    <span className="mt-1 h-5 w-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Check /></span>
                    <span className="text-sm">{L(b)}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={450}>
              <Link href="/sell/register" className="inline-flex items-center gap-2 font-semibold text-ink-900 hover:text-brand-700 group">
                {t('Open your shop — free', 'अपना स्टोर खोलें — मुफ़्त')}
                <span className="inline-block transition-transform group-hover:translate-x-1.5"><ArrowRight /></span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============= MISSION QUOTE ============= */}
      <section className="relative bg-ink-900 text-white py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none animate-pan" style={{
          backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(241,100,30,0.55), transparent 40%), radial-gradient(circle at 70% 70%, rgba(232,163,61,0.55), transparent 40%)',
          backgroundSize: '200% 200%',
        }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <Reveal><span className="inline-block font-display text-5xl text-brand-600 leading-none mb-4 animate-spin-slow">✦</span></Reveal>
          <Reveal delay={100}>
            <blockquote className="font-display text-4xl md:text-6xl leading-[1.1] tracking-tight" dangerouslySetInnerHTML={{ __html: t(
              '“Every artisan deserves a store of their own.<br /><span class="text-gradient-warm italic">And a fair cut of every sale.”</span>',
              '“हर कारीगर अपने खुद के स्टोर का हक़दार है।<br /><span class="text-gradient-warm italic">और हर बिक्री में उचित हिस्से का।”</span>',
            ) }} />
          </Reveal>
          <Reveal delay={300}><p className="mt-8 text-sm uppercase tracking-[0.25em] text-white/60">The Vrindaonline Marketplace · Est. 2026</p></Reveal>
        </div>
      </section>

      {/* ============= ARTISAN-TYPE MARQUEE ============= */}
      <section className="bg-canvas py-12 border-y border-line">
        <Reveal className="max-w-container mx-auto px-6 mb-6">
          <p className="text-center text-xs uppercase tracking-[0.25em] text-ink-500 font-semibold">{t('Open to independent artisans across India', 'भारत भर के स्वतंत्र कारीगरों के लिए खुला')}</p>
        </Reveal>
        <Marquee speed="slow">
          {VENDOR_TICKER.map((v) => (<span key={v} className="px-10 font-display text-2xl md:text-3xl text-ink-300 hover:text-ink-900 transition-colors duration-300">{v}</span>))}
        </Marquee>
      </section>

      {/* ============= OUR PROMISE ============= */}
      <section className="max-w-container mx-auto px-6 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">{t('Our promise', 'हमारा वादा')}</p>
          <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.05]">{t('What we owe to every maker on the platform.', 'प्लेटफ़ॉर्म के हर मेकर के लिए हमारा फ़र्ज़।')}</h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {PROMISES.map((p, i) => (
            <Reveal key={i} delay={i * 120}>
              <article className="h-full bg-surface rounded-2xl border border-line p-7 lift">
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-700 font-semibold mb-3">{L(p.eyebrow)}</p>
                <h3 className="font-display text-2xl text-ink-900 mb-3 leading-tight">{L(p.title)}</h3>
                <p className="text-sm text-ink-700 leading-relaxed">{L(p.body)}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============= FAQ ============= */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-20 md:py-28 scroll-mt-10">
        <Reveal className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">{t('Questions, answered', 'सवाल, जवाब के साथ')}</p>
          <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.05]">{t('Everything you need to know.', 'वो सब जो आपको जानना चाहिए।')}</h2>
        </Reveal>
        <Reveal delay={120}><FAQAccordion items={faqItems} /></Reveal>
        <Reveal delay={300} className="mt-10 text-center">
          <p className="text-sm text-ink-700">
            {t('Ready when you are.', 'जब आप तैयार हों।')}{' '}
            <Link href="/sell/register" className="text-brand-700 font-semibold underline underline-offset-4 hover:no-underline">{t('Open your shop', 'अपना स्टोर खोलें')}</Link>{' '}
            {t('— it’s free to start.', '— शुरू करना मुफ़्त है।')}
          </p>
        </Reveal>
      </section>

      {/* ============= FINAL CTA ============= */}
      <section className="max-w-container mx-auto px-6 pb-24">
        <Reveal>
          <TiltCard max={4}>
            <div className="gradient-ring relative overflow-hidden rounded-3xl bg-ink-900 text-white p-10 md:p-16 lift text-center">
              <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-[#FFC58A]"><Sparkle /></div>
              <h3 className="font-display text-3xl md:text-5xl leading-[1.1] mb-3 max-w-2xl mx-auto">{t('Turn your craft into a livelihood.', 'अपने हुनर को आजीविका बनाएं।')}</h3>
              <p className="text-white/70 mb-8 max-w-xl mx-auto" dangerouslySetInnerHTML={{ __html: t(
                '<span class="font-semibold text-[#FFC58A]">Free to join. 10% only when you sell.</span> Your own branded store, weekly direct payouts, no monthly bill — ever.',
                '<span class="font-semibold text-[#FFC58A]">जुड़ना मुफ़्त। 10% सिर्फ़ बिक्री पर।</span> आपका अपना ब्रांडेड स्टोर, हर हफ़्ते सीधे भुगतान, कभी कोई मासिक बिल नहीं।',
              ) }} />
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/sell/register" className="inline-flex items-center justify-center bg-brand-600 text-white font-semibold rounded-pill px-7 py-3.5 hover:bg-brand-700 transition gap-2">
                  {t('Open your shop', 'अपना स्टोर खोलें')}
                  <ArrowRight />
                </Link>
                <Link href="/how-it-works" className="inline-flex items-center justify-center bg-white/10 border border-white/30 text-white font-semibold rounded-pill px-7 py-3.5 hover:bg-white/20 transition">
                  {t('See how it works', 'देखें कैसे काम करता है')}
                </Link>
              </div>
              <span className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full pointer-events-none" style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,163,61,0.55) 0%, rgba(232,163,61,0) 70%)' }} />
            </div>
          </TiltCard>
        </Reveal>
      </section>

      {/* ============= MINI FOOTER ============= */}
      <footer className="border-t border-line bg-canvas">
        <div className="max-w-container mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo markClassName="h-7 w-7" textClassName="font-display text-2xl text-brand-600" />
            <span className="text-xs text-ink-500">{t('Your branded jewellery store · India · Est. 2026', 'आपका ब्रांडेड ज्वेलरी स्टोर · भारत · Est. 2026')}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-700">
            <Link href="/how-it-works" className="hover:text-brand-700">{t('How it works', 'कैसे काम करता है')}</Link>
            <Link href="/sell/login" className="hover:text-brand-700">{t('Log in', 'लॉग इन')}</Link>
            <Link href="/sell/register" className="hover:text-brand-700">{t('Start selling', 'बेचना शुरू करें')}</Link>
          </div>
          <div className="text-xs text-ink-500">© {new Date().getFullYear()} Vrindaonline. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Inline icons ----------
function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-ink-700">
      <span className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}
function ArrowRight() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>); }
function Sparkle() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v3" /><path d="M12 18v3" /><path d="M5 12H2" /><path d="M22 12h-3" /><path d="M19.07 4.93 17 7" /><path d="m7 17-2.07 2.07" /><path d="M19.07 19.07 17 17" /><path d="m7 7-2.07-2.07" /></svg>); }
function Check() { return (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>); }
function ShieldCheck() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>); }
function Award() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6" /><path d="m9 14-1.5 7L12 18l4.5 3L15 14" /></svg>); }
function Truck() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>); }
