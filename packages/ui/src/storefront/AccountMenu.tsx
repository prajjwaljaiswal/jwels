'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';

interface Me {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
}

export function AccountMenu({ storeKey: forcedKey }: { storeKey?: string } = {}) {
  const isStorefront = !!forcedKey;
  const router = useRouter();
  const pathname = usePathname() || '';
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // When inside a vendor storefront, link to vendor-scoped pages so theme persists.
  // forcedKey is passed directly from the storefront layout (avoids regex in that app).
  const storeMatch = useMemo(
    () => forcedKey ? [null, forcedKey] : pathname.match(/^\/store\/([^/]+)/),
    [forcedKey, pathname],
  );
  const accountHref   = storeMatch ? `/${storeMatch[1]}/account`   : '/account';
  const ordersHref    = storeMatch ? `/${storeMatch[1]}/orders`    : '/orders';
  const wishlistHref  = storeMatch ? `/${storeMatch[1]}/wishlist`  : '/account/wishlist';
  const addressesHref = storeMatch ? `/${storeMatch[1]}/addresses` : '/account/addresses';
  const loginHref     = storeMatch ? `/login?next=${encodeURIComponent(pathname)}` : '/login';
  const registerHref  = storeMatch ? `/register?next=${encodeURIComponent(pathname)}` : '/register';

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem(process.env.NEXT_PUBLIC_TOKEN_KEY || 'token') : null;
    if (!t) { setReady(true); return; }
    api<Me>('/api/auth/me', { silent: true })
      .then(setMe)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function signOut() {
    setToken(null);
    setMe(null);
    setOpen(false);
    toast.success('Signed out');
    router.push('/');
    router.refresh();
  }

  if (!ready) return <span className="text-sm text-ink-500">…</span>;

  if (!me) {
    return (
      <div className="flex items-center gap-3">
        <Link href={loginHref} className="hover:text-brand-700">Sign in</Link>
        <span className="text-ink-300">·</span>
        <Link href={registerHref} className="hover:text-brand-700">Register</Link>
      </div>
    );
  }

  const initial = (me.name || me.email).trim().charAt(0).toUpperCase();
  const firstName = me.name?.split(' ')[0] || me.email;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2 hover:text-brand-700"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden sm:inline">Hi, {firstName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 bg-surface border border-line rounded-md shadow-card py-2 z-50">
          <div className="px-4 py-2 border-b border-line">
            <p className="text-sm font-semibold text-ink-900 truncate">{me.name}</p>
            <p className="text-xs text-ink-500 truncate">{me.email}</p>
          </div>
          <Link href={accountHref}   onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">My account</Link>
          <Link href={ordersHref}    onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">My orders</Link>
          <Link href={wishlistHref}  onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">Wishlist</Link>
          <Link href={addressesHref} onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">Addresses</Link>
          {me.role === 'VENDOR' && (
            <Link href="/vendor" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">Vendor dashboard</Link>
          )}
          {me.role === 'ADMIN' && (
            <Link href="/admin" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">Admin</Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-canvas border-t border-line"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
