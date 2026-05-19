'use client';
import { useEffect } from 'react';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';

/**
 * Mounts once at the root layout. If the user is logged in, fetches server cart
 * and wishlist ids in parallel and replaces local state. Safe for guests (no-op).
 */
export function CartHydrator() {
  const hydrateCart = useCart((s) => s.hydrate);
  const hydrateWishlist = useWishlist((s) => s.hydrateIds);
  useEffect(() => {
    void hydrateCart();
    void hydrateWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
