'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi, serverItemToLocal, type ServerCart } from './cart-api';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  vendorId?: string;
  vendorName: string;
  // Variation snapshot — same productId with different combos = distinct lines.
  variationComboId?: string;
  variationLabel?: string;
}

// Composite key so a product with multiple combo selections gets distinct cart lines.
const lineKey = (i: { productId: string; variationComboId?: string }) =>
  i.variationComboId ? `${i.productId}::${i.variationComboId}` : i.productId;

export type AddResult =
  | { status: 'added' | 'incremented' }
  | { status: 'conflict'; existingVendor: string; newVendor: string };

function isAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem('token');
}

interface CartState {
  items: CartItem[];
  /** Server CartItem.id keyed by local lineKey. Empty for guests. */
  serverIds: Record<string, string>;
  hydrating: boolean;
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => AddResult;
  /** Replaces the cart with a single item from a different vendor. Used after a confirmed conflict. */
  replaceWith: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  remove: (productId: string, variationComboId?: string) => void;
  setQty: (productId: string, qty: number, variationComboId?: string) => void;
  clear: () => void;
  total: () => number;
  vendorId: () => string | null;
  vendorName: () => string | null;
  /** Fetch the server cart and replace local state. Safe to call on every mount. */
  hydrate: () => Promise<void>;
  /** Post current local items to /api/cart/merge then hydrate. Call after login. */
  mergeAndHydrate: () => Promise<void>;
}

function applyServerCart(cart: ServerCart): { items: CartItem[]; serverIds: Record<string, string> } {
  const items: CartItem[] = [];
  const serverIds: Record<string, string> = {};
  for (const it of cart.items) {
    const local = serverItemToLocal(it);
    items.push(local);
    serverIds[lineKey(local)] = it.id;
  }
  return { items, serverIds };
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      serverIds: {},
      hydrating: false,

      add: (item, qty = 1) => {
        const items = get().items;

        // Single-vendor cart: reject if a different vendor's items already exist.
        if (item.vendorId && items.length > 0) {
          const existingVendor = items[0].vendorId;
          if (existingVendor && existingVendor !== item.vendorId) {
            return {
              status: 'conflict',
              existingVendor: items[0].vendorName,
              newVendor: item.vendorName,
            };
          }
        }

        const key = lineKey(item);
        const existing = items.find((i) => lineKey(i) === key);
        if (existing) {
          set({
            items: items.map((i) =>
              lineKey(i) === key ? { ...i, quantity: i.quantity + qty } : i,
            ),
          });
        } else {
          set({ items: [...items, { ...item, quantity: qty }] });
        }

        if (isAuthed()) {
          cartApi
            .add({ productId: item.productId, quantity: qty, variationComboId: item.variationComboId })
            .then((c) => set(applyServerCart(c)))
            .catch(() => {
              // Roll back the optimistic add so the cart stays consistent with the server.
              set((s) => {
                const key = lineKey(item);
                const prev = s.items.find((i) => lineKey(i) === key);
                if (!prev) return s;
                const reverted = prev.quantity - qty <= 0
                  ? s.items.filter((i) => lineKey(i) !== key)
                  : s.items.map((i) => lineKey(i) === key ? { ...i, quantity: i.quantity - qty } : i);
                return { items: reverted };
              });
              get().hydrate();
            });
        }

        return existing ? { status: 'incremented' } : { status: 'added' };
      },

      replaceWith: (item, qty = 1) => {
        set({ items: [{ ...item, quantity: qty }], serverIds: {} });
        if (isAuthed()) {
          cartApi
            .clear()
            .then(() => cartApi.add({ productId: item.productId, quantity: qty, variationComboId: item.variationComboId }))
            .then((c) => set(applyServerCart(c)))
            .catch(() => get().hydrate());
        }
      },

      remove: (productId, variationComboId) => {
        const key = lineKey({ productId, variationComboId });
        const serverId = get().serverIds[key];
        set((s) => {
          const { [key]: _omit, ...rest } = s.serverIds;
          return {
            items: s.items.filter((i) => lineKey(i) !== key),
            serverIds: rest,
          };
        });
        if (isAuthed() && serverId) {
          cartApi.remove(serverId)
            .then((c) => set(applyServerCart(c)))
            .catch(() => get().hydrate());
        }
      },

      setQty: (productId, qty, variationComboId) => {
        const key = lineKey({ productId, variationComboId });
        const safeQty = Math.max(1, qty);
        const serverId = get().serverIds[key];
        set((s) => ({
          items: s.items.map((i) => (lineKey(i) === key ? { ...i, quantity: safeQty } : i)),
        }));
        if (isAuthed() && serverId) {
          cartApi.updateQty(serverId, safeQty)
            .then((c) => set(applyServerCart(c)))
            .catch(() => get().hydrate());
        }
      },

      clear: () => {
        set({ items: [], serverIds: {} });
        if (isAuthed()) {
          cartApi.clear().catch(() => {});
        }
      },

      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      vendorId: () => get().items[0]?.vendorId ?? null,
      vendorName: () => get().items[0]?.vendorName ?? null,

      hydrate: async () => {
        if (!isAuthed()) return;
        if (get().hydrating) return;
        set({ hydrating: true });
        try {
          const cart = await cartApi.get();
          set({ ...applyServerCart(cart), hydrating: false });
        } catch {
          set({ hydrating: false });
        }
      },

      mergeAndHydrate: async () => {
        if (!isAuthed()) return;
        const local = get().items;
        try {
          if (local.length > 0) {
            const payload = local.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              variationComboId: i.variationComboId,
            }));
            const cart = await cartApi.merge(payload);
            set(applyServerCart(cart));
          } else {
            await get().hydrate();
          }
        } catch {
          await get().hydrate();
        }
      },
    }),
    {
      name: 'cart',
      // Don't persist server IDs or hydrating flag — they are session state.
      partialize: (s) => ({ items: s.items }) as any,
    },
  ),
);

/**
 * Convenience wrapper: tries to add; on vendor conflict, asks the user (via window.confirm)
 * whether to replace the cart with the new item. Returns true if something was added.
 */
export function addToCartWithVendorGuard(
  item: Omit<CartItem, 'quantity'>,
  qty = 1,
): boolean {
  const result = useCart.getState().add(item, qty);
  if (result.status !== 'conflict') return true;

  if (typeof window === 'undefined') return false;
  const ok = window.confirm(
    `Your cart already has items from ${result.existingVendor}. Each checkout is paid to a single vendor. Replace cart with items from ${result.newVendor}?`,
  );
  if (!ok) return false;

  useCart.getState().replaceWith(item, qty);
  return true;
}
