import Link from 'next/link';

const PERKS = [
  { title: 'Reach jewelry lovers', body: 'List your handcrafted pieces in front of buyers actively shopping for unique jewelry.' },
  { title: 'Flat 10% commission', body: 'No subscriptions, no listing fees. We earn only when you sell.' },
  { title: 'Weekly payouts', body: 'Earnings settle to your bank account every week once orders are delivered.' },
  { title: 'Branded storefront', body: 'Your own logo, banner, theme, and shop URL on Jewel.' },
];

const STEPS = [
  'Create your seller account in under a minute.',
  'Complete a 6-step onboarding: shop, business, bank, pickup, branding, ID.',
  'Our team reviews your KYC within 24–48 hours.',
  'Start listing and selling — payouts run weekly.',
];

export default function SellLandingPage() {
  return (
    <div className="max-w-container mx-auto px-6">
      {/* Hero */}
      <section className="py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-700 font-semibold mb-3">Sell on Jewel</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink-900 leading-tight">
            Turn your craft into a thriving jewelry shop.
          </h1>
          <p className="text-ink-700 mt-4 max-w-lg">
            Join independent jewelers across India selling on Jewel. Open your shop, list your pieces,
            and reach buyers who love handcrafted, hallmarked jewelry.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/sell/register" className="btn-primary !py-3 !px-6">Start selling</Link>
            <Link href="/sell/login" className="btn-secondary !py-3 !px-6">Sign in to your shop</Link>
          </div>
          <p className="text-xs text-ink-500 mt-3">No setup fees · Flat 10% commission · Weekly payouts</p>
        </div>
        <div className="relative aspect-[5/6] rounded-md overflow-hidden bg-brand-50">
          <img
            src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=900&q=80"
            alt="Independent jewelry seller at her bench"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Perks */}
      <section className="py-12 border-t border-line">
        <h2 className="font-display text-3xl text-ink-900 mb-8">Why sell on Jewel</h2>
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
        <h2 className="font-display text-3xl text-ink-900 mb-8">How it works</h2>
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
        <h2 className="font-display text-3xl text-ink-900">Ready to open your shop?</h2>
        <p className="text-ink-700 mt-2">A few details and you're on your way.</p>
        <Link href="/sell/register" className="btn-primary !py-3 !px-8 mt-5 inline-block">Start selling</Link>
      </section>
    </div>
  );
}
