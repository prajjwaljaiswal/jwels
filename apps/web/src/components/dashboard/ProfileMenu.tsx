'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, setToken } from '@/lib/api';

interface Me {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
}

interface Props {
  variant?: 'vendor' | 'admin';
}

export function ProfileMenu({ variant = 'vendor' }: Props) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Me>('/api/auth/me', { silent: true }).then(setMe).catch(() => {});
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
    router.push('/login');
    router.refresh();
  }

  const initial = me ? (me.name || me.email).trim().charAt(0).toUpperCase() : variant === 'admin' ? 'A' : 'V';
  const avatarClass =
    variant === 'admin'
      ? 'h-8 w-8 rounded-full bg-ink-900 text-white text-xs font-bold flex items-center justify-center'
      : 'h-8 w-8 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={avatarClass}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
      >
        {initial}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 bg-surface border border-line rounded-md shadow-card py-2 z-50">
          {me ? (
            <div className="px-4 py-2 border-b border-line">
              <p className="text-sm font-semibold text-ink-900 truncate">{me.name}</p>
              <p className="text-xs text-ink-500 truncate">{me.email}</p>
            </div>
          ) : (
            <div className="px-4 py-2 border-b border-line">
              <p className="text-xs text-ink-500">Not signed in</p>
            </div>
          )}

          <Link href="/account" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">
            My account
          </Link>
          {variant === 'vendor' && (
            <Link href="/storefront" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">
              My storefront
            </Link>
          )}
          {variant === 'admin' && (
            <Link href="/settings" onClick={() => setOpen(false)} className="block px-4 py-2 text-sm hover:bg-canvas">
              Settings
            </Link>
          )}

          {me ? (
            <button
              type="button"
              onClick={signOut}
              className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-canvas border-t border-line"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm hover:bg-canvas border-t border-line"
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
