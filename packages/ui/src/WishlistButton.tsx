'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useWishlist } from '@/lib/wishlist';

interface Props {
  productId: string;
  /** Visual style. "icon" = floating heart on cards. "pill" = labelled button for PDP. */
  variant?: 'icon' | 'pill';
  className?: string;
}

export function WishlistButton({ productId, variant = 'icon', className = '' }: Props) {
  const isWished = useWishlist((s) => s.isWished(productId));
  const toggle = useWishlist((s) => s.toggle);
  const loaded = useWishlist((s) => s.loaded);
  const [busy, setBusy] = useState(false);

  // Lazy-hydrate ids on first mount of any heart on the page.
  const hydrateIds = useWishlist((s) => s.hydrateIds);
  useEffect(() => {
    if (!loaded) void hydrateIds();
  }, [loaded, hydrateIds]);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const added = await toggle(productId);
      toast.success(added ? 'Saved to wishlist' : 'Removed from wishlist');
    } finally {
      setBusy(false);
    }
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={isWished}
        aria-label={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
        className={[
          'inline-flex items-center gap-2 h-11 px-5 rounded-pill border text-sm font-semibold transition',
          isWished
            ? 'bg-brand-50 border-brand-500 text-brand-700'
            : 'bg-surface border-line text-ink-900 hover:border-ink-700',
          className,
        ].join(' ')}
      >
        <Heart filled={isWished} size={18} />
        {isWished ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={isWished}
      aria-label={isWished ? 'Remove from wishlist' : 'Add to wishlist'}
      className={[
        'inline-flex items-center justify-center w-9 h-9 rounded-full bg-surface/95 shadow-card border border-line/60 transition hover:scale-105',
        isWished ? 'text-brand-600' : 'text-ink-700 hover:text-brand-600',
        className,
      ].join(' ')}
    >
      <Heart filled={isWished} size={18} />
    </button>
  );
}

function Heart({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
