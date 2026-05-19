'use client';

// Storefront checkout route — chooses between block-rendered checkout (when
// the vendor has a published system CHECKOUT page) and the legacy hard-coded
// flow.
//
// Block-rendered checkout = decoration blocks (announcement, trust strip,
// gift wrap, custom fields) rendered above/below the LegacyVendorCheckoutPage
// core. The required address/shipping/payment blocks are markers — see
// components/blocks/checkout/renderers.tsx for the rationale. This keeps
// Razorpay/COD flow untouched while still letting vendors customise the
// surrounding chrome.

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { CheckoutBlockProvider } from '@/components/blocks/checkout/CheckoutContext';
import { LegacyVendorCheckoutPage } from './LegacyCheckoutLayout';

interface SystemPagePayload {
  id: string;
  vendorId: string;
  blocks: any[];
}

// Block types belonging to the legacy "core". The first one we hit splits the
// block list into before/after; the core itself is mounted once.
const CORE_BLOCK_TYPES = new Set([
  'checkoutSteps',
  'checkoutAddressForm',
  'checkoutShipping',
  'checkoutPayment',
  'checkoutOrderSummary',
]);

export default function VendorCheckoutRoute() {
  const { vendor } = useVendor();
  const [systemPage, setSystemPage] = useState<SystemPagePayload | null | undefined>(undefined);

  useEffect(() => {
    api<SystemPagePayload>(`/api/storefront-pages/${vendor.id}/system/CHECKOUT`, { auth: false, silent: true })
      .then((p) => setSystemPage(p))
      .catch(() => setSystemPage(null));
  }, [vendor.id]);

  if (systemPage === undefined) {
    return <div className="max-w-6xl mx-auto px-5 py-16 text-center text-ink-500">Loading…</div>;
  }
  if (systemPage === null) {
    return <LegacyVendorCheckoutPage />;
  }
  return <BlockRenderedCheckout blocks={systemPage.blocks} />;
}

function BlockRenderedCheckout({ blocks }: { blocks: any[] }) {
  const { vendor, theme, storeKey } = useVendor();

  // Split blocks at the first core block; remaining core blocks are filtered
  // out of `after` so they don't mount the legacy flow twice.
  const splitIdx = useMemo(() => blocks.findIndex((b) => CORE_BLOCK_TYPES.has(b.type)), [blocks]);
  const before = splitIdx === -1 ? blocks : blocks.slice(0, splitIdx);
  const after  = splitIdx === -1 ? [] : blocks.slice(splitIdx + 1).filter((b) => !CORE_BLOCK_TYPES.has(b.type));

  const ctx = { scope: 'vendor' as const, vendorId: vendor.id, pageKind: 'CHECKOUT' as const };

  return (
    <CheckoutBlockProvider vendorId={vendor.id} storeKey={storeKey} theme={theme}>
      <div>
        {before.length > 0 && (
          <div className="max-w-6xl mx-auto px-5 pt-6">
            <BlockRenderer blocks={before} ctx={ctx} />
          </div>
        )}

        {/* Legacy address → shipping → payment flow — untouched. */}
        <LegacyVendorCheckoutPage />

        {after.length > 0 && (
          <div className="max-w-6xl mx-auto px-5 pb-10">
            <BlockRenderer blocks={after} ctx={ctx} />
          </div>
        )}
      </div>
    </CheckoutBlockProvider>
  );
}
