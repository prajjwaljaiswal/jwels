'use client';
import { create } from 'zustand';
import toast from 'react-hot-toast';
import { api } from './api';

export interface WishlistProduct {
  id: string;
  name: string;
  images: string[];
  price: number;
  stockQuantity: number;
  isActive: boolean;
  status: string;
  vendor: { id: string; shopName: string; shopLogoUrl: string | null };
}

export interface WishlistItem {
  id: string;
  productId: string;
  addedAt: string;
  product: WishlistProduct;
}

interface WishlistState {
  ids: Set<string>;
  items: WishlistItem[];
  loaded: boolean;
  isWished: (productId: string) => boolean;
  count: () => number;
  hydrate: () => Promise<void>;
  hydrateIds: () => Promise<void>;
  add: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  toggle: (productId: string) => Promise<boolean>;
  clearLocal: () => void;
}

function isAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem(process.env.NEXT_PUBLIC_TOKEN_KEY || 'token');
}

export const useWishlist = create<WishlistState>((set, get) => ({
  ids: new Set<string>(),
  items: [],
  loaded: false,

  isWished: (productId) => get().ids.has(productId),
  count: () => get().ids.size,

  hydrate: async () => {
    if (!isAuthed()) {
      set({ ids: new Set(), items: [], loaded: true });
      return;
    }
    try {
      const data = await api<{ items: WishlistItem[]; count: number }>('/api/wishlist', { silent: true });
      set({
        items: data.items,
        ids: new Set(data.items.map((i) => i.productId)),
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  hydrateIds: async () => {
    if (!isAuthed()) {
      set({ ids: new Set(), loaded: true });
      return;
    }
    try {
      const data = await api<{ productIds: string[] }>('/api/wishlist/ids', { silent: true });
      set({ ids: new Set(data.productIds), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  add: async (productId) => {
    if (!isAuthed()) {
      toast.error('Sign in to save items');
      return;
    }
    const prev = new Set(get().ids);
    set({ ids: new Set([...prev, productId]) });
    try {
      await api('/api/wishlist', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
    } catch {
      set({ ids: prev });
    }
  },

  remove: async (productId) => {
    if (!isAuthed()) return;
    const prev = new Set(get().ids);
    const next = new Set(prev);
    next.delete(productId);
    set({
      ids: next,
      items: get().items.filter((i) => i.productId !== productId),
    });
    try {
      await api(`/api/wishlist/${productId}`, { method: 'DELETE' });
    } catch {
      set({ ids: prev });
    }
  },

  toggle: async (productId) => {
    const wished = get().ids.has(productId);
    if (wished) {
      await get().remove(productId);
      return false;
    }
    await get().add(productId);
    return true;
  },

  clearLocal: () => set({ ids: new Set(), items: [], loaded: false }),
}));
