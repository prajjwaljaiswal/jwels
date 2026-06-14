'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';
import { Reveal } from '@/components/landing/Reveal';
import { Marquee } from '@/components/landing/Marquee';
import { MagneticButton } from '@/components/landing/MagneticButton';
import { SparkleCanvas } from '@/components/landing/SparkleCanvas';
import { Parallax } from '@/components/landing/Parallax';
import { CursorSpotlight } from '@/components/landing/CursorSpotlight';
import { ScrollProgress } from '@/components/landing/ScrollProgress';
import { StickyCta } from '@/components/landing/StickyCta';
import { TiltCard } from '@/components/landing/TiltCard';
import { FAQAccordion } from '@/components/landing/FAQAccordion';

// ---------- Static content ----------

const HEADLINE = ['Where', 'every', 'jewel', 'tells', 'a', 'story.'];

const HERO_STACK = [
  { src: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80', alt: 'Layered gold necklace', tilt: '-rotate-3', pos: 'top-0 left-4 z-30' },
  { src: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=700&q=80', alt: 'Pearl drop earrings', tilt: 'rotate-6', pos: 'top-16 right-0 z-20' },
  { src: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=700&q=80', alt: 'Solitaire ring', tilt: '-rotate-6', pos: 'bottom-0 left-0 z-10' },
];

const TICKER = [
  '✦ FREE TO LIST · 10% ONLY WHEN YOU SELL',
  '✦ WEEKLY PAYOUTS VIA RAZORPAY',
  '✦ BIS HALLMARKED · IGI CERTIFIED',
  '✦ 30-DAY EASY RETURNS',
  '✦ MADE IN INDIA, BY INDEPENDENT ARTISANS',
  '✦ GST-COMPLIANT INVOICES, AUTOMATED',
];

const VENDOR_TICKER = [
  'Goldsmiths of Jaipur',
  'Silversmiths of Cuttack',
  'Kundan ateliers',
  'Temple-jewellery makers',
  'Meenakari studios',
  'Filigree workshops',
  'Polki specialists',
  'Pearl designers',
  'Tribal-silver artisans',
  'Contemporary studios',
];

const PILLARS = [
  { title: '₹0', suffix: '', label: 'No listing fee — open your shop free.' },
  { title: '24', suffix: 'h', label: 'KYC review — go live in under a day.' },
  { title: '7', suffix: 'd', label: 'Weekly direct payouts to your bank.' },
  { title: '30', suffix: 'd', label: 'Return window we help coordinate.' },
];

const CATEGORIES = [
  { label: 'Necklaces', from: '₹1,200', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&q=80', slug: 'necklaces', span: 'md:col-span-2 md:row-span-2', height: 'aspect-[5/6]' },
  { label: 'Earrings', from: '₹650', img: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=600&q=80', slug: 'earrings', span: '', height: 'aspect-square' },
  { label: 'Rings', from: '₹1,800', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80', slug: 'rings', span: '', height: 'aspect-square' },
  { label: 'Bracelets', from: '₹950', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&q=80', slug: 'bracelets', span: '', height: 'aspect-square' },
  { label: 'Bridal sets', from: '₹14,500', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600&q=80', slug: 'bridal', span: '', height: 'aspect-square' },
  { label: 'Gifting', from: '₹490', img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=900&q=80', slug: 'gifting', span: 'md:col-span-2', height: 'aspect-[2/1]' },
];

const BUYER_STEPS = [
  { n: '01', t: 'Browse handcrafted pieces', d: 'Verified independent artisans across India — every shop reviewed before going live.' },
  { n: '02', t: 'Pay securely with Razorpay', d: 'UPI, cards, netbanking and wallets — PCI-DSS secured checkout.' },
  { n: '03', t: 'Delivered with care', d: 'Tracked shipping with an easy 30-day return window we help coordinate.' },
];
const SELLER_STEPS = [
  { n: '01', t: 'Open your shop in minutes', d: 'List products, photos and prices — no signup fee, no monthly bill.' },
  { n: '02', t: 'Reach jewellery buyers nationwide', d: 'We bring the buyers and run the checkout. You focus on the craft.' },
  { n: '03', t: 'Get paid every week', d: 'Direct bank payouts every week for delivered orders. No delays, no minimums.' },
];

// Honest "Our promise" pillars (replaces fake testimonial section)
const PROMISES = [
  {
    eyebrow: 'To buyers',
    title: 'Every piece, verified.',
    body: "BIS hallmarking on gold, IGI/SGL certification on stones, and clear photos of the actual product you receive. If it doesn't match, we refund — full stop.",
  },
  {
    eyebrow: 'To artisans',
    title: 'You keep what you earn.',
    body: 'No listing fees. No monthly subscriptions. No setup cost. Weekly payouts direct to your bank, no minimum threshold.',
  },
  {
    eyebrow: 'To the craft',
    title: 'A stage, not a sweatshop.',
    body: 'We onboard independent makers — not resellers, not factories. Every shop has a real name, a real city, and a real story behind the work.',
  },
];

const FAQS = [
  {
    q: 'How much does it cost to sell on Vrindaonline?',
    a: "Zero to start. There's no listing fee, no monthly subscription, and no annual contract. Opening your shop and listing your products is completely free.",
  },
  {
    q: 'How and when do I get paid?',
    a: 'Payouts run every week through Razorpay, direct to your bank account. We generate GST-compliant invoices for both you and your customer automatically. Every transaction is visible in your payouts dashboard.',
  },
  {
    q: 'Who handles shipping and returns?',
    a: "You ship the product yourself; we provide pre-printed labels and integrations with Delhivery, BlueDart and India Post. If a buyer initiates a return within 30 days, we coordinate the pickup and refund flow so you don't have to chase couriers.",
  },
  {
    q: 'Do I need GST registration to sell?',
    a: 'You can start without GST if your annual turnover is under ₹40 lakh. Above that, GST registration is required by law. We issue GST-compliant invoices from day one for both you and your customers.',
  },
  {
    q: 'How does Vrindaonline verify artisans?',
    a: 'Every new shop is reviewed by our team before going live. We verify your identity (PAN/Aadhaar), bank account, and a small sample of pieces. For gold and gemstone listings, we require BIS hallmarking and IGI/SGL certificates respectively.',
  },
];

// ---------- Page ----------

export default function HomePage() {
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ items: any[] }>('/api/products?limit=12', { auth: false, silent: true })
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true));
  }, []);

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

          <div className="absolute inset-0 -z-10 pointer-events-none">
            <SparkleCanvas density={75} />
          </div>

          <div
            className="absolute inset-0 -z-10 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7), rgba(0,0,0,0) 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7), rgba(0,0,0,0) 70%)',
            }}
          />

          <div className="absolute top-6 left-0 right-0 z-20">
            <div className="max-w-container mx-auto px-6 flex items-center justify-between">
              <span className="font-display text-3xl text-brand-600 leading-none drop-shadow-sm">
                Vrindaonline
              </span>
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm font-medium text-ink-900 hover:text-brand-700 transition-colors px-3 py-2"
                >
                  Sign in
                </Link>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-pill bg-white/80 backdrop-blur border border-line text-ink-900 px-4 py-2 hover:bg-white transition"
                >
                  Browse shop
                </Link>
              </div>
            </div>
          </div>

          <div className="max-w-container mx-auto px-6 pt-28 md:pt-32 pb-24 md:pb-32 grid md:grid-cols-12 gap-10 md:gap-14 items-center">
            {/* LEFT — copy */}
            <div className="md:col-span-7 relative">
              <span className="inline-flex items-center gap-2 rounded-pill glass border border-line px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 shadow-card">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-glow" />
                Now onboarding our founding artisans
              </span>

              <h1 className="font-display text-5xl sm:text-6xl md:text-[5.25rem] leading-[1.02] text-ink-900 mt-6 tracking-tight">
                {HEADLINE.map((w, i) => {
                  const isAccent = w === 'jewel';
                  return (
                    <span
                      key={i}
                      className="headline-word"
                      style={{ animationDelay: `${120 + i * 90}ms` }}
                    >
                      {isAccent ? (
                        <span className="text-gradient-warm italic">{w}</span>
                      ) : (
                        w
                      )}
                    </span>
                  );
                })}
              </h1>

              <p
                className="text-lg text-ink-700 max-w-xl mt-6 fade-up-load"
                style={{ animationDelay: '900ms' }}
              >
                A new home for handcrafted jewellery from independent artisans across India —
                <span className="text-ink-900 font-medium"> verified pieces, fair payouts, zero middlemen.</span>
              </p>

              <div
                className="flex flex-wrap items-center gap-3 mt-9 fade-up-load"
                style={{ animationDelay: '1100ms' }}
              >
                <MagneticButton href="/products" variant="primary">
                  Shop the collection
                  <ArrowRight />
                </MagneticButton>
                <MagneticButton href="#sell" variant="secondary">
                  Sell on Vrindaonline
                  <Sparkle />
                </MagneticButton>
              </div>

              {/* Honest trust row — replaces fake "loved by 50,000" */}
              <div
                className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 fade-up-load"
                style={{ animationDelay: '1300ms' }}
              >
                <TrustBadge icon={<ShieldCheck />} label="Razorpay secure checkout" />
                <TrustBadge icon={<Award />} label="BIS hallmark · IGI certified" />
                <TrustBadge icon={<Truck />} label="30-day easy returns" />
              </div>
            </div>

            {/* RIGHT — image stack with tilt */}
            <div className="md:col-span-5 relative h-[520px] md:h-[600px]">
              {HERO_STACK.map((s, i) => (
                <div
                  key={i}
                  className={`absolute ${s.pos} w-[68%] aspect-[3/4] ${s.tilt} ${i === 0 ? 'animate-float-slow' : i === 1 ? 'animate-float' : 'animate-bob'}`}
                >
                  <TiltCard max={9}>
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-pop ring-1 ring-white/60">
                      <img src={s.src} alt={s.alt} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                    </div>
                  </TiltCard>
                </div>
              ))}

              {/* Honest pricing chip — replaces "Editor's pick / 347 shopping right now" */}
              <div className="hidden md:flex absolute -bottom-2 left-2 z-40 items-center gap-3 bg-white rounded-pill shadow-pop pl-2 pr-5 py-2 animate-bob">
                <span className="h-9 w-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Sparkle />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-ink-500 font-semibold">For artisans</p>
                  <p className="text-sm font-semibold text-ink-900 -mt-0.5">Free to list · 10% only when you sell</p>
                </div>
              </div>

              <div className="absolute top-2 -left-2 z-40 hidden md:flex items-center gap-2 bg-ink-900 text-white rounded-pill px-3.5 py-2 text-xs shadow-pop animate-float">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="font-medium">Founding-vendor sign-ups open</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 bottom-6 flex-col items-center gap-2 text-ink-500 text-[11px] uppercase tracking-[0.2em]">
            <span>Scroll</span>
            <span className="h-8 w-[1px] bg-ink-300 relative overflow-hidden">
              <span className="absolute top-0 left-0 h-3 w-full bg-brand-600 animate-scroll-hint" />
            </span>
          </div>
        </section>
      </CursorSpotlight>

      {/* ============= TICKER ============= */}
      <section className="bg-ink-900 text-white py-5 border-y border-ink-700/40">
        <Marquee speed="normal">
          {TICKER.map((t) => (
            <span
              key={t}
              className="px-8 text-sm font-medium tracking-[0.2em] uppercase whitespace-nowrap"
            >
              {t}
            </span>
          ))}
        </Marquee>
      </section>

      {/* ============= PILLARS (honest, replaces fake STATS) ============= */}
      <section className="max-w-container mx-auto px-6 py-20 md:py-28">
        <Reveal as="div" className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">
            How Vrindaonline works
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-ink-900">
            A fairer <span className="text-gradient-warm italic">marketplace</span> for makers and lovers of beautiful things.
          </h2>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-6">
          {PILLARS.map((p, i) => (
            <Reveal
              key={p.label}
              delay={i * 120}
              className="text-center md:border-r md:last:border-r-0 border-line"
            >
              <div className="font-display text-5xl md:text-6xl text-ink-900 leading-none">
                {p.title}
                <span className="text-3xl md:text-4xl align-top ml-1 text-brand-700">{p.suffix}</span>
              </div>
              <p className="text-sm text-ink-700 mt-3 max-w-[14rem] mx-auto">{p.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============= CATEGORIES — asymmetric grid ============= */}
      <section className="max-w-container mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-2 inline-block eyebrow-underline">
              Find your style
            </p>
            <h2 className="font-display text-4xl md:text-5xl text-ink-900 max-w-xl leading-[1.05]">
              Browse by category.
            </h2>
          </Reveal>
          <Reveal direction="right" delay={120}>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900 hover:text-brand-700 group"
            >
              Explore all
              <span className="inline-block transition-transform group-hover:translate-x-1.5">
                <ArrowRight />
              </span>
            </Link>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 md:auto-rows-[180px]">
          {CATEGORIES.map((c, i) => (
            <Reveal
              key={c.slug}
              delay={i * 80}
              direction="zoom"
              className={`${c.span} group relative`}
            >
              <Link
                href={`/products?category=${c.slug}`}
                className={`zoom-on-hover relative block w-full h-full ${c.height} rounded-2xl overflow-hidden bg-stone-100 lift`}
              >
                <img
                  src={c.img}
                  alt={c.label}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={i < 2 ? 'eager' : 'lazy'}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 flex items-end justify-between text-white">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-80">From {c.from}</p>
                    <h3 className="font-display text-2xl md:text-3xl mt-1 transition-transform duration-500 group-hover:-translate-y-0.5">
                      {c.label}
                    </h3>
                  </div>
                  <span className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all duration-300 group-hover:bg-white group-hover:text-ink-900">
                    <ArrowRight />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============= EDITOR'S PICKS ============= */}
      <section className="max-w-container mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-2 inline-block eyebrow-underline">
              Fresh from the workshop
            </p>
            <h2 className="font-display text-4xl md:text-5xl text-ink-900 max-w-xl leading-[1.05]">
              New arrivals from our artisans.
            </h2>
          </Reveal>
          <Reveal direction="right" delay={100}>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900 hover:text-brand-700 group"
            >
              See all products
              <span className="inline-block transition-transform group-hover:translate-x-1.5">
                <ArrowRight />
              </span>
            </Link>
          </Reveal>
        </div>

        {!loaded ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="aspect-square bg-stone-100 animate-pulse" />
                <div className="h-3 mt-3 bg-stone-100 rounded animate-pulse" />
                <div className="h-3 mt-2 w-2/3 bg-stone-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {items.slice(0, 8).map((p, i) => (
              <Reveal key={p.id} delay={i * 60} direction="up">
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <FallbackProductGrid />
        )}
      </section>

      {/* ============= DUAL "HOW IT WORKS" ============= */}
      <section className="relative overflow-hidden">
        <div className="grid md:grid-cols-2">
          {/* BUY side */}
          <div className="relative bg-canvas border-t border-line p-8 md:p-16 overflow-hidden">
            <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full glow-gold pointer-events-none animate-aurora" />
            <Reveal>
              <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">
                For shoppers
              </p>
              <h3 className="font-display text-3xl md:text-4xl text-ink-900 leading-[1.05] mb-3">
                Shop with confidence.
              </h3>
              <p className="text-ink-700 max-w-md">
                Every seller is verified. Every payment is protected. If a piece doesn't match its listing, we'll refund you — full stop.
              </p>
            </Reveal>

            <ol className="mt-10 space-y-6">
              {BUYER_STEPS.map((s, i) => (
                <Reveal key={s.n} delay={140 + i * 120} className="flex gap-5 items-start">
                  <span className="step-number">{s.n}</span>
                  <div className="pt-3">
                    <h4 className="font-semibold text-ink-900">{s.t}</h4>
                    <p className="text-sm text-ink-700 mt-1 max-w-md">{s.d}</p>
                  </div>
                </Reveal>
              ))}
            </ol>

            <Reveal delay={500} className="mt-10">
              <Link href="/products" className="btn-primary">Start shopping</Link>
            </Reveal>
          </div>

          {/* SELL side */}
          <div id="sell" className="relative bg-ink-900 text-white p-8 md:p-16 overflow-hidden scroll-mt-10">
            <div
              className="absolute inset-0 pointer-events-none opacity-30 animate-pan"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, rgba(241,100,30,0.55), transparent 45%), radial-gradient(circle at 80% 80%, rgba(232,163,61,0.45), transparent 50%)',
                backgroundSize: '200% 200%',
              }}
            />
            <Reveal direction="right">
              <p className="text-xs uppercase tracking-[0.2em] text-[#FFC58A] font-semibold mb-3 inline-block">
                For makers
              </p>
              <h3 className="font-display text-3xl md:text-4xl leading-[1.05] mb-3">
                Sell your craft to the world.
              </h3>
              <p className="text-white/70 max-w-md">
                Free to start, free to stay. No monthly bill, no listing fee, no contract. We make money only when you do.
              </p>
            </Reveal>

            <ol className="mt-10 space-y-6">
              {SELLER_STEPS.map((s, i) => (
                <Reveal key={s.n} direction="right" delay={140 + i * 120} className="flex gap-5 items-start">
                  <span className="step-number">{s.n}</span>
                  <div className="pt-3">
                    <h4 className="font-semibold">{s.t}</h4>
                    <p className="text-sm text-white/70 mt-1 max-w-md">{s.d}</p>
                  </div>
                </Reveal>
              ))}
            </ol>

            <Reveal direction="right" delay={500} className="mt-10">
              <Link
                href="#pricing"
                className="inline-flex items-center justify-center bg-white text-ink-900 font-semibold rounded-pill px-7 py-3.5 transition hover:bg-brand-600 hover:text-white gap-2"
              >
                See how pricing works
                <ArrowRight />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============= ARTISAN SPOTLIGHT (parallax) ============= */}
      <section className="relative bg-canvas py-24 md:py-32 overflow-hidden">
        <div className="max-w-container mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
          <Reveal direction="left" className="md:col-span-6 relative h-[520px] md:h-[640px]">
            <Parallax speed={0.18} className="h-full">
              <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-pop">
                <img
                  src="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80"
                  alt="Artisan crafting jewelry"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-ink-900/55 via-transparent to-transparent" />
              </div>
            </Parallax>

            <Parallax speed={-0.12} className="absolute -bottom-6 -right-6 md:-right-10">
              <div className="bg-white rounded-2xl shadow-pop p-5 max-w-[280px]">
                <div className="flex items-center gap-2 text-brand-700 mb-2">
                  <Sparkle />
                  <span className="text-[10px] uppercase tracking-[0.18em] font-semibold">Founder's note</span>
                </div>
                <p className="text-xs text-ink-700 leading-relaxed">
                  “We built Vrindaonline because India's independent jewellery makers deserve better than 30% cuts and pay-to-play listings.”
                </p>
                <p className="text-xs font-semibold text-ink-900 mt-2">— The Vrindaonline team</p>
              </div>
            </Parallax>
          </Reveal>

          <div className="md:col-span-6 md:pl-6">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">
                Built for artisans
              </p>
              <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.05] mb-6">
                Real makers. <br />
                <span className="text-gradient-warm italic">Fair economics.</span>
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-lg text-ink-700 mb-6 max-w-lg">
                Behind every piece on Vrindaonline is a person — a goldsmith in Jaipur, a silversmith in Cuttack, a designer
                in Bandra. Our job is to give them a stage, not to tax their craft.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <ul className="space-y-3 mb-8">
                {[
                  'BIS hallmarking and IGI/SGL gemstone verification',
                  'Weekly Razorpay payouts — direct, no minimum threshold',
                  'GST-compliant invoices generated automatically',
                  'Pre-printed shipping labels (Delhivery · BlueDart · India Post)',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3 text-ink-900">
                    <span className="mt-1 h-5 w-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      <Check />
                    </span>
                    <span className="text-sm">{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={450}>
              <Link
                href="/register?role=vendor"
                className="inline-flex items-center gap-2 font-semibold text-ink-900 hover:text-brand-700 group"
              >
                Open your shop — free
                <span className="inline-block transition-transform group-hover:translate-x-1.5">
                  <ArrowRight />
                </span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============= MISSION QUOTE ============= */}
      <section className="relative bg-ink-900 text-white py-24 md:py-32 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none animate-pan"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 30%, rgba(241,100,30,0.55), transparent 40%), radial-gradient(circle at 70% 70%, rgba(232,163,61,0.55), transparent 40%)',
            backgroundSize: '200% 200%',
          }}
        />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <Reveal>
            <span className="inline-block font-display text-5xl text-brand-600 leading-none mb-4 animate-spin-slow">✦</span>
          </Reveal>
          <Reveal delay={100}>
            <blockquote className="font-display text-4xl md:text-6xl leading-[1.1] tracking-tight">
              “Every piece deserves to be seen.
              <br />
              <span className="text-gradient-warm italic">Every artisan deserves a fair cut.”</span>
            </blockquote>
          </Reveal>
          <Reveal delay={300}>
            <p className="mt-8 text-sm uppercase tracking-[0.25em] text-white/60">
              The Vrindaonline Marketplace · Est. 2026
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============= ARTISAN-TYPE MARQUEE (above pricing) ============= */}
      <section className="bg-canvas py-12 border-y border-line">
        <Reveal className="max-w-container mx-auto px-6 mb-6">
          <p className="text-center text-xs uppercase tracking-[0.25em] text-ink-500 font-semibold">
            Open to independent artisans across India
          </p>
        </Reveal>
        <Marquee speed="slow">
          {VENDOR_TICKER.map((v) => (
            <span
              key={v}
              className="px-10 font-display text-2xl md:text-3xl text-ink-300 hover:text-ink-900 transition-colors duration-300"
            >
              {v}
            </span>
          ))}
        </Marquee>
      </section>

      {/* ============= FAQ ============= */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-20 md:py-28 scroll-mt-10">
        <Reveal className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">
            Questions, answered
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.05]">
            Everything you need to know.
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <FAQAccordion items={FAQS} />
        </Reveal>

        <Reveal delay={300} className="mt-10 text-center">
          <p className="text-sm text-ink-700">
            Still curious?{' '}
            <Link href="/register?role=vendor" className="text-brand-700 font-semibold underline underline-offset-4 hover:no-underline">
              Talk to our team
            </Link>
            {' '}— we usually reply within an hour.
          </p>
        </Reveal>
      </section>

      {/* ============= OUR PROMISE (replaces fake testimonials & press) ============= */}
      <section className="max-w-container mx-auto px-6 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-700 font-semibold mb-3 inline-block eyebrow-underline">
            Our promise
          </p>
          <h2 className="font-display text-4xl md:text-5xl text-ink-900 leading-[1.05]">
            What we owe to every side of the table.
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {PROMISES.map((p, i) => (
            <Reveal key={p.eyebrow} delay={i * 120}>
              <article className="h-full bg-surface rounded-2xl border border-line p-7 lift">
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-700 font-semibold mb-3">
                  {p.eyebrow}
                </p>
                <h3 className="font-display text-2xl text-ink-900 mb-3 leading-tight">{p.title}</h3>
                <p className="text-sm text-ink-700 leading-relaxed">{p.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============= DUAL FINAL CTA ============= */}
      <section className="max-w-container mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Buyer card */}
          <Reveal direction="left">
            <TiltCard max={5}>
              <div className="gradient-ring relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FFF1E8] to-white p-10 md:p-14 lift h-full">
                <div className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/70 backdrop-blur flex items-center justify-center text-brand-700">
                  <Heart />
                </div>
                <h3 className="font-display text-3xl md:text-4xl text-ink-900 leading-[1.1] mb-3 max-w-sm">
                  Discover your next favourite piece.
                </h3>
                <p className="text-ink-700 mb-7 max-w-sm">
                  Sign up and get <span className="font-semibold text-brand-700">10% off</span> your first order, plus early access to new drops from founding artisans.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/products" className="btn-primary">Shop now</Link>
                  <Link href="/register" className="btn-secondary">Create account</Link>
                </div>
                <span className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full glow-warm pointer-events-none" />
              </div>
            </TiltCard>
          </Reveal>

          {/* Seller card */}
          <Reveal direction="right" delay={120}>
            <TiltCard max={5}>
              <div className="gradient-ring relative overflow-hidden rounded-3xl bg-ink-900 text-white p-10 md:p-14 lift h-full">
                <div className="absolute top-6 right-6 h-12 w-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-[#FFC58A]">
                  <Sparkle />
                </div>
                <h3 className="font-display text-3xl md:text-4xl leading-[1.1] mb-3 max-w-sm">
                  Turn your craft into a livelihood.
                </h3>
                <p className="text-white/70 mb-7 max-w-sm">
                  <span className="font-semibold text-[#FFC58A]">Free to join. 10% only when you sell.</span> Weekly direct payouts. No monthly bill, ever.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/register?role=vendor"
                    className="inline-flex items-center justify-center bg-brand-600 text-white font-semibold rounded-pill px-6 py-3 hover:bg-brand-700 transition gap-2"
                  >
                    Open your shop
                    <ArrowRight />
                  </Link>
                  <Link
                    href="#pricing"
                    className="inline-flex items-center justify-center bg-white/10 border border-white/30 text-white font-semibold rounded-pill px-6 py-3 hover:bg-white/20 transition"
                  >
                    How pricing works
                  </Link>
                </div>
                <span
                  className="absolute -bottom-12 -left-12 h-44 w-44 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(232,163,61,0.55) 0%, rgba(232,163,61,0) 70%)' }}
                />
              </div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* ============= MINI FOOTER ============= */}
      <footer className="border-t border-line bg-canvas">
        <div className="max-w-container mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl text-brand-600">Vrindaonline</span>
            <span className="text-xs text-ink-500">Handcrafted marketplace · India · Est. 2026</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-700">
            <Link href="/products" className="hover:text-brand-700">Shop</Link>
            <Link href="#pricing" className="hover:text-brand-700">Pricing</Link>
            <Link href="/register?role=vendor" className="hover:text-brand-700">Sell</Link>
            <Link href="/login" className="hover:text-brand-700">Sign in</Link>
          </div>
          <div className="text-xs text-ink-500">
            © {new Date().getFullYear()} Vrindaonline Marketplace. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Inline icons & fallback grid ----------

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-ink-700">
      <span className="h-7 w-7 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
function Sparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M5 12H2" />
      <path d="M22 12h-3" />
      <path d="M19.07 4.93 17 7" />
      <path d="m7 17-2.07 2.07" />
      <path d="M19.07 19.07 17 17" />
      <path d="m7 7-2.07-2.07" />
    </svg>
  );
}
function Heart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8 3.5 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4c4 0 7 4 5 8.5C19 16.65 12 21 12 21z" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
function ShieldCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function Award() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="6" />
      <path d="m9 14-1.5 7L12 18l4.5 3L15 14" />
    </svg>
  );
}
function Truck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

// Sample pieces shown only when the catalogue is empty (Day-0 placeholder).
// No fake ratings/review counts — those appear only on real shipped products.
const FALLBACK_PRODUCTS: ProductCardData[] = [
  {
    id: 'demo-1',
    name: 'Layered gold-plated chain necklace',
    price: 2499,
    mrp: 3499,
    images: ['https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=700&q=80'],
    vendor: { shopName: 'Sample artisan' },
    freeShipping: true,
    badge: 'Coming soon',
  },
  {
    id: 'demo-2',
    name: 'Pearl drop statement earrings',
    price: 1199,
    images: ['https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=700&q=80'],
    vendor: { shopName: 'Sample artisan' },
    freeShipping: true,
    badge: 'Coming soon',
  },
  {
    id: 'demo-3',
    name: 'Solitaire silver promise ring',
    price: 1899,
    mrp: 2499,
    images: ['https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=700&q=80'],
    vendor: { shopName: 'Sample artisan' },
    freeShipping: false,
    badge: 'Coming soon',
  },
  {
    id: 'demo-4',
    name: 'Kundan choker with matching tikka',
    price: 14500,
    images: ['https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=700&q=80'],
    vendor: { shopName: 'Sample artisan' },
    freeShipping: true,
    badge: 'Coming soon',
  },
];

function FallbackProductGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {FALLBACK_PRODUCTS.map((p, i) => (
        <Reveal key={p.id} delay={i * 60}>
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}
