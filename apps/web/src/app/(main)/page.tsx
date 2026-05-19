'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/storefront/ProductCard';

const TILES = [
  { label: 'Necklaces', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&q=80', slug: 'necklaces' },
  { label: 'Earrings', img: 'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=400&q=80', slug: 'earrings' },
  { label: 'Rings', img: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400&q=80', slug: 'rings' },
  { label: 'Bracelets', img: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&q=80', slug: 'bracelets' },
  { label: 'Bridal', img: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=400&q=80', slug: 'bridal' },
  { label: 'Gifting', img: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=400&q=80', slug: 'gifting' },
];

const TRUST = [
  { title: 'Certified vendors', body: 'Every seller is verified and approved by our team.' },
  { title: 'Free returns', body: '30-day no-questions-asked returns on every order.' },
  { title: 'Secure payments', body: 'Pay safely with Razorpay — UPI, cards, netbanking.' },
  { title: 'Hallmarked gold', body: 'BIS-hallmarked gold and certified gemstones.' },
];

export default function HomePage() {
  const [items, setItems] = useState<ProductCardData[]>([]);

  useEffect(() => {
    api<{ items: any[] }>('/api/products?limit=12', { auth: false })
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="bg-canvas">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="max-w-container mx-auto px-6 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs tracking-[0.18em] uppercase text-brand-700 font-semibold mb-4">
              New collection · Spring 2026
            </p>
            <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-ink-900 mb-5">
              Handcrafted jewelry, made just for you.
            </h1>
            <p className="text-lg text-ink-700 max-w-lg mb-8">
              Discover one-of-a-kind pieces from independent jewelers across India — earrings, necklaces, rings and more.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary">Shop new arrivals</Link>
              <Link href="/auth/register?role=vendor" className="btn-secondary">Become a vendor</Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-md overflow-hidden bg-brand-50">
              <img
                src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80"
                alt="Featured jewelry"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="hidden md:block absolute -bottom-6 -left-6 bg-white shadow-pop rounded-md p-4 max-w-[220px]">
              <p className="text-xs text-ink-500 uppercase tracking-wide font-semibold">Editor's pick</p>
              <p className="text-sm font-semibold text-ink-900 mt-1">Kundan choker set</p>
              <p className="text-sm text-brand-700 font-bold mt-1">₹14,500</p>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORY CIRCLES */}
      <section className="max-w-container mx-auto px-6 py-10">
        <h2 className="font-display text-2xl md:text-3xl mb-8 text-center">Shop by category</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
          {TILES.map((t) => (
            <Link key={t.slug} href={`/products?category=${t.slug}`} className="flex flex-col items-center group">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-brand-50 ring-1 ring-line group-hover:ring-brand-600 transition">
                <img src={t.img} alt={t.label} className="w-full h-full object-cover" />
              </div>
              <span className="mt-3 text-sm font-medium text-ink-900 group-hover:text-brand-700">
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CURATED RAIL */}
      <section className="max-w-container mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl text-ink-900">Editor's picks</h2>
            <p className="text-sm text-ink-700 mt-1">Hand-selected pieces our buyers are loving this week.</p>
          </div>
          <Link href="/products" className="btn-ghost text-sm">See all</Link>
        </div>

        {items.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md overflow-hidden">
                <div className="aspect-square bg-stone-100 animate-pulse" />
                <div className="h-3 mt-3 bg-stone-100 rounded animate-pulse" />
                <div className="h-3 mt-2 w-2/3 bg-stone-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {items.slice(0, 8).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* TRUST BAND */}
      <section className="bg-surface border-y border-line mt-10">
        <div className="max-w-container mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {TRUST.map((t) => (
            <div key={t.title}>
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-ink-900">{t.title}</h4>
              <p className="text-sm text-ink-700 mt-1">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="max-w-container mx-auto px-6 py-16">
        <div className="rounded-md bg-brand-50 p-10 md:p-14 text-center">
          <h3 className="font-display text-3xl md:text-4xl text-ink-900 mb-3">Sell your craft on Jewel</h3>
          <p className="text-ink-700 max-w-xl mx-auto mb-6">
            Reach thousands of jewelry lovers. We handle payments, you focus on what you make best.
          </p>
          <Link href="/auth/register?role=vendor" className="btn-primary">Open your shop</Link>
        </div>
      </section>
    </div>
  );
}
