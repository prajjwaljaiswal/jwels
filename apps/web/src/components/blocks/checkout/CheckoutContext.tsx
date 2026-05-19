'use client';

// Checkout block context — supplies theme, store key, and vendor-scoped state
// for the *decorative* checkout blocks (gift wrap, custom fields, trust strip,
// announcement, FAQ). The address → shipping → payment flow continues to live
// inside <LegacyVendorCheckoutPage> for safety — those required blocks are
// markers that render nothing here.
//
// This deliberately stops short of extracting the Razorpay/COD state machine.
// Vendors can re-order surrounding decoration; the payment flow stays intact.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CheckoutCustomFieldValues {
  [key: string]: string;
}

interface CheckoutState {
  vendorId: string;
  storeKey: string;
  theme: string;
  giftWrap: boolean;
  setGiftWrap: (v: boolean) => void;
  customFields: CheckoutCustomFieldValues;
  setCustomField: (key: string, value: string) => void;
}

const CheckoutContext = createContext<CheckoutState | null>(null);

export function useCheckoutBlock(): CheckoutState | null {
  return useContext(CheckoutContext);
}

interface CheckoutProviderProps {
  vendorId: string;
  storeKey: string;
  theme: string;
  children: ReactNode;
}

export function CheckoutBlockProvider({ vendorId, storeKey, theme, children }: CheckoutProviderProps) {
  const [giftWrap, setGiftWrap] = useState(false);
  const [customFields, setCustomFields] = useState<CheckoutCustomFieldValues>({});

  const value: CheckoutState = useMemo(() => ({
    vendorId,
    storeKey,
    theme,
    giftWrap,
    setGiftWrap,
    customFields,
    setCustomField: (key, val) => setCustomFields((prev) => ({ ...prev, [key]: val })),
  }), [vendorId, storeKey, theme, giftWrap, customFields]);

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
}

export function CheckoutFallback({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="my-2 rounded-md border border-dashed border-ink-200 bg-canvas/40 px-4 py-6 text-sm">
      <div className="font-medium text-ink-800">{label}</div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
      <div className="mt-2 text-[11px] text-ink-500">Preview will populate with real checkout data on the storefront.</div>
    </div>
  );
}
