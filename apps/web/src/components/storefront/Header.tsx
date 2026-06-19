'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/lib/cart';
import { AccountMenu } from './AccountMenu';
import { NotificationBell } from '@/components/support/NotificationBell';
import { SearchAutosuggest } from '@/components/search/SearchAutosuggest';
import { MegaMenu } from './MegaMenu';
import { Logo } from '@/components/brand/Logo';

const ALGOLIA_READY =
  !!process.env.NEXT_PUBLIC_ALGOLIA_APP_ID && !!process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

export function Header() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const [q, setQ] = useState('');
  const itemCount = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  // Hide on vendor / admin dashboard routes — they use their own shell
  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    router.push(`/products?${params.toString()}`);
  }

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-line">
      {/* Row 1 */}
      <div className="max-w-container mx-auto px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-1 shrink-0">
          <Logo />
        </Link>

        {ALGOLIA_READY ? (
          <SearchAutosuggest className="flex-1 max-w-3xl" />
        ) : (
          <form onSubmit={submit} className="flex-1 max-w-3xl">
            <div className="flex items-center h-12 rounded-pill border border-ink-900 focus-within:ring-2 focus-within:ring-brand-600 overflow-hidden bg-white">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search for anything"
                className="flex-1 h-full px-5 text-sm bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="m-1 h-10 w-10 rounded-full bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition"
              >
                <SearchIcon />
              </button>
            </div>
          </form>
        )}

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <NotificationBell />
          <AccountMenu />
          <Link href="/vendor" className="hover:text-brand-700">Sell</Link>
          <Link href="/cart" className="relative inline-flex items-center" aria-label="Cart">
            <CartIcon />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-brand-600 text-white text-[11px] font-semibold flex items-center justify-center px-1">
                {itemCount}
              </span>
            )}
          </Link>
        </nav>
      </div>

      {/* Row 2 — category mega-menu */}
      <MegaMenu />
    </header>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  );
}
