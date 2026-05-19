'use client';

// Cart block context — provides the vendor-scoped cart items, theme, store key,
// and the handful of mutations the cart blocks need (qty, remove, save-for-later,
// proceed-to-checkout). Blocks render placeholders when used outside this
// provider (i.e. in the page-editor preview).

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CartItem } from '@/lib/cart';

interface CartState {
  storeKey: string;
  vendorId: string;
  vendorName: string;
  theme: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  setQty: (productId: string, qty: number, variationComboId?: string) => void;
  remove: (productId: string, variationComboId?: string) => void;
  saveForLater: (productId: string, variationComboId?: string) => Promise<void>;
  proceedToCheckout: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function useCartBlock(): CartState | null {
  return useContext(CartContext);
}

interface CartProviderProps extends Omit<CartState, 'itemCount' | 'subtotal'> {
  children: ReactNode;
}

export function CartBlockProvider({ children, ...rest }: CartProviderProps) {
  const value: CartState = useMemo(() => {
    const itemCount = rest.items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = rest.items.reduce((s, i) => s + i.price * i.quantity, 0);
    return { ...rest, itemCount, subtotal };
  }, [rest]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function CartFallback({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="my-2 rounded-md border border-dashed border-ink-200 bg-canvas/40 px-4 py-6 text-sm">
      <div className="font-medium text-ink-800">{label}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
      <div className="mt-2 text-[11px] text-ink-500">Preview will populate with real cart items on the storefront.</div>
    </div>
  );
}
