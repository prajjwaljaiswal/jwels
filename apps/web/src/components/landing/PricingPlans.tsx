'use client';
import Link from 'next/link';
import { Reveal } from './Reveal';
import { TiltCard } from './TiltCard';
import { Counter } from './Counter';

/** Base monthly price, in ₹. Change in one place — all cards recompute. */
const BASE_MONTHLY = 7000;

type Plan = {
  id: 'monthly' | 'quarterly' | 'halfyearly' | 'annual';
  name: string;
  months: number;
  /** 0 = no discount, 0.10 = 10% off vs monthly, etc. */
  discount: number;
  /** Floating ribbon shown above the card. */
  tierLabel?: string;
  /** Visual treatment. */
  variant: 'flat' | 'standard' | 'recommended' | 'best-value';
  features: string[];
  cta: { label: string; href: string };
};

const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    months: 1,
    discount: 0,
    variant: 'flat',
    cta: { label: 'Start monthly', href: '/register?role=vendor&plan=monthly' },
    features: [
      'Unlimited product listings',
      'Verified vendor badge',
      'Razorpay weekly payouts',
      'Standard category placement',
      'Email & chat support',
    ],
  },
  {
    id: 'quarterly',
    name: 'Quarterly',
    months: 3,
    discount: 0.10,
    tierLabel: 'Recommended',
    variant: 'recommended',
    cta: { label: 'Choose Quarterly', href: '/register?role=vendor&plan=quarterly' },
    features: [
      'Everything in Monthly',
      'Priority chat support',
      '1 promotional banner slot',
      'Early access to new features',
    ],
  },
  {
    id: 'halfyearly',
    name: 'Half-yearly',
    months: 6,
    discount: 0.20,
    variant: 'standard',
    cta: { label: 'Choose Half-yearly', href: '/register?role=vendor&plan=halfyearly' },
    features: [
      'Everything in Quarterly',
      'Featured category placement',
      '3 promotional banner slots',
      '1 free photography session (5 products)',
      'Dedicated account manager',
    ],
  },
  {
    id: 'annual',
    name: 'Annual',
    months: 12,
    discount: 0.30,
    tierLabel: 'Best value',
    variant: 'best-value',
    cta: { label: 'Choose Annual', href: '/register?role=vendor&plan=annual' },
    features: [
      'Everything in Half-yearly',
      'Editor’s pick launch placement',
      '6 promotional banner slots',
      '2 free photography sessions',
      '1-on-1 onboarding manager',
      'Press kit + social media kickoff',
    ],
  },
];

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function computePricing(plan: Plan) {
  const fullPrice = BASE_MONTHLY * plan.months;
  const total = Math.round(fullPrice * (1 - plan.discount));
  const perMonth = Math.round(total / plan.months);
  const saved = fullPrice - total;
  const savedPct = Math.round(plan.discount * 100);
  return { fullPrice, total, perMonth, saved, savedPct };
}

export function PricingPlans() {
  return (
    <div>
      {/* Extra top padding so the floating "Recommended" / "Best value" ribbons
          have room to lift above the card edge without being clipped. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 max-w-[1280px] mx-auto pt-6">
        {PLANS.map((p, i) => (
          <Reveal key={p.id} delay={i * 120} direction="zoom" className="h-full">
            <PlanCard plan={p} />
          </Reveal>
        ))}
      </div>

      <Reveal delay={500} className="mt-14 flex flex-wrap justify-center items-center gap-x-8 gap-y-3 text-xs text-white/60">
        <span className="inline-flex items-center gap-1.5">
          <CheckPill /> No hidden fees
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckPill /> Cancel anytime
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckPill /> GST invoice included
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckPill /> Secured by Razorpay
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckPill /> Switch tiers any time
        </span>
      </Reveal>
    </div>
  );
}

type Variant = Plan['variant'];

const VARIANT_STYLES: Record<Variant, { card: string; sub: string; accent: string; cta: string; bullet: string; box: string; isDark: boolean }> = {
  flat: {
    card: 'bg-white text-ink-900 border border-line',
    sub: 'text-ink-700',
    accent: 'text-brand-700',
    cta: 'bg-ink-900 text-white hover:bg-brand-600',
    bullet: 'bg-brand-50 text-brand-700',
    box: 'border-line bg-canvas',
    isDark: false,
  },
  standard: {
    card: 'bg-white text-ink-900 border border-line ring-1 ring-brand-100',
    sub: 'text-ink-700',
    accent: 'text-brand-700',
    cta: 'bg-ink-900 text-white hover:bg-brand-600',
    bullet: 'bg-brand-50 text-brand-700',
    box: 'border-line bg-canvas',
    isDark: false,
  },
  recommended: {
    card: 'bg-ink-900 text-white border-2 border-brand-600/50 shadow-[0_0_50px_rgba(241,100,30,0.22)]',
    sub: 'text-white/65',
    accent: 'text-[#FFC58A]',
    cta: 'bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_22px_rgba(241,100,30,0.45)] hover:shadow-[0_12px_30px_rgba(241,100,30,0.55)]',
    bullet: 'bg-brand-600 text-white',
    box: 'border-white/15 bg-white/5',
    isDark: true,
  },
  'best-value': {
    card: 'bg-gradient-to-br from-ink-900 via-[#2a1a0d] to-ink-900 text-white border-2 border-[#FFC58A]/50 shadow-[0_0_50px_rgba(255,197,138,0.20)]',
    sub: 'text-white/65',
    accent: 'text-[#FFC58A]',
    cta: 'bg-[#FFC58A] text-ink-900 hover:bg-white shadow-[0_8px_22px_rgba(255,197,138,0.35)]',
    bullet: 'bg-[#FFC58A] text-ink-900',
    box: 'border-white/15 bg-white/5',
    isDark: true,
  },
};

function PlanCard({ plan }: { plan: Plan }) {
  const { fullPrice, total, perMonth, saved, savedPct } = computePricing(plan);
  const isFlat = plan.discount === 0;
  const s = VARIANT_STYLES[plan.variant];

  return (
    <TiltCard max={5} className="h-full">
      <article className={`relative h-full rounded-3xl p-7 md:p-8 lift overflow-visible ${s.card}`}>
        {/* Inner clip wrapper for aurora blobs so they don't bleed past the rounded corners */}
        {s.isDark && (
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none" aria-hidden="true">
            <span
              className="absolute -top-20 -right-20 h-72 w-72 rounded-full animate-aurora"
              style={{
                background:
                  plan.variant === 'best-value'
                    ? 'radial-gradient(50% 50% at 50% 50%, rgba(255,197,138,0.45) 0%, rgba(255,197,138,0) 70%)'
                    : 'radial-gradient(50% 50% at 50% 50%, rgba(241,100,30,0.55) 0%, rgba(241,100,30,0) 70%)',
              }}
            />
            <span
              className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full animate-aurora-2"
              style={{
                background:
                  'radial-gradient(50% 50% at 50% 50%, rgba(232,163,61,0.35) 0%, rgba(232,163,61,0) 70%)',
              }}
            />
          </div>
        )}

        {/* FLOATING TIER RIBBON (Recommended / Best value) — lifts above card edge */}
        {plan.tierLabel && (
          <span
            className={`absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,0.25)] animate-pulse-ring ${
              plan.variant === 'best-value'
                ? 'bg-[#FFC58A] text-ink-900'
                : 'bg-brand-600 text-white'
            }`}
          >
            <span aria-hidden>{plan.variant === 'best-value' ? '★' : '✦'}</span>
            {plan.tierLabel}
          </span>
        )}

        {/* TOP-RIGHT DISCOUNT PILL — short, compact, just the % */}
        {plan.discount > 0 && (
          <span
            className={`absolute top-5 right-5 z-10 inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap ${
              s.isDark
                ? 'bg-white/12 text-white border border-white/20 backdrop-blur-sm'
                : 'bg-brand-50 text-brand-700 border border-brand-100'
            }`}
            aria-label={`${savedPct} percent off vs paying monthly`}
          >
            {savedPct}% OFF
          </span>
        )}

        <div className="relative">
          {/* Header */}
          <h3 className="font-display text-3xl md:text-4xl pr-20">{plan.name}</h3>
          <p className={`text-sm mt-1.5 ${s.sub}`}>
            {plan.months === 1 ? 'Pay as you go' : `${plan.months} months commitment`}
          </p>

          {/* Big total */}
          <div className="mt-7 flex items-baseline gap-2">
            <span className="font-display text-5xl md:text-[3.75rem] tabular-nums leading-none">
              {formatINR(total)}
            </span>
          </div>
          <p className={`text-xs mt-2 uppercase tracking-[0.18em] font-semibold ${s.accent}`}>
            {plan.months === 1 ? 'per month' : `for ${plan.months} months`}
          </p>

          {/* Per-month breakdown */}
          {!isFlat ? (
            <div className={`mt-5 rounded-2xl border ${s.box} p-4`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-xs uppercase tracking-wider font-semibold ${s.sub}`}>
                  Effective
                </span>
                <span className={`font-display text-2xl tabular-nums ${s.accent}`}>
                  {formatINR(perMonth)}
                  <span className={`text-xs font-medium ml-1 ${s.sub}`}>/ mo</span>
                </span>
              </div>
              <div className={`mt-2 h-px ${s.isDark ? 'bg-white/10' : 'bg-line'}`} />
              <div className="flex items-baseline justify-between gap-3 mt-2">
                <span className={`text-xs ${s.sub}`}>
                  vs <s>{formatINR(fullPrice)}</s>
                </span>
                <span className={`text-xs font-bold ${s.accent}`}>
                  Save <Counter to={saved} prefix="₹" />
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-line bg-canvas p-4">
              <p className="text-xs text-ink-700 leading-relaxed">
                Pure flexibility — bill renews every month, cancel before any cycle.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className={`my-7 h-px ${s.isDark ? 'bg-white/10' : 'bg-line'}`} />

          {/* Features */}
          <ul className="space-y-3">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full flex items-center justify-center ${s.bullet}`}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <span className={`text-sm leading-relaxed ${s.isDark ? 'text-white/90' : 'text-ink-700'}`}>
                  {f}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link
            href={plan.cta.href}
            className={`mt-8 w-full inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3.5 font-semibold transition-all duration-300 ${s.cta}`}
          >
            {plan.cta.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </article>
    </TiltCard>
  );
}

function CheckPill() {
  return (
    <span className="h-4 w-4 rounded-full bg-white/10 text-[#FFC58A] inline-flex items-center justify-center">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
    </span>
  );
}
