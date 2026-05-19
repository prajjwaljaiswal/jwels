'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Re-export everything from config so existing imports (`from '@/lib/currency'`)
// continue to work unchanged in client components.
export { CURRENCIES, formatPrice, toINR } from './currency.config';
export type { CurrencyCode } from './currency.config';

import type { CurrencyCode } from './currency.config';

interface CurrencyState {
  code: CurrencyCode;
  setCode: (c: CurrencyCode) => void;
}

export const useCurrency = create<CurrencyState>()(
  persist(
    (set) => ({ code: 'INR', setCode: (code) => set({ code }) }),
    { name: 'currency' }
  )
);
