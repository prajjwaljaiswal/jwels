import { api } from './api';
import type { CartItem } from './cart';

export interface ServerCartItem {
  id: string;
  productId: string;
  variationComboId: string | null;
  quantity: number;
  addedAt: string;
  unitPrice: number;
  lineTotal: number;
  stock: number;
  variationLabel: string | null;
  product: {
    id: string;
    name: string;
    images: string[];
    price: number;
    isActive: boolean;
    status: string;
    vendor: { id: string; shopName: string; shopLogoUrl: string | null };
  };
}

export interface ServerCart {
  id: string;
  userId: string;
  items: ServerCartItem[];
  subtotal: number;
  itemCount: number;
  updatedAt: string;
}

export function serverItemToLocal(it: ServerCartItem): CartItem {
  return {
    productId: it.productId,
    name: it.product.name,
    price: it.unitPrice,
    image: it.product.images[0] ?? '',
    quantity: it.quantity,
    vendorId: it.product.vendor.id,
    vendorName: it.product.vendor.shopName,
    variationComboId: it.variationComboId ?? undefined,
    variationLabel: it.variationLabel ?? undefined,
  };
}

export const cartApi = {
  get: () => api<ServerCart>('/api/cart', { silent: true }),
  add: (input: { productId: string; quantity: number; variationComboId?: string }) =>
    api<ServerCart>('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify(input),
      silent: true,
    }),
  updateQty: (itemId: string, quantity: number) =>
    api<ServerCart>(`/api/cart/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  remove: (itemId: string) =>
    api<ServerCart>(`/api/cart/items/${itemId}`, { method: 'DELETE' }),
  clear: () => api<ServerCart>('/api/cart', { method: 'DELETE' }),
  merge: (items: { productId: string; quantity: number; variationComboId?: string }[]) =>
    api<ServerCart>('/api/cart/merge', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
};
