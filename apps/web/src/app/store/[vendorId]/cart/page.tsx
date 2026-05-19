'use client';

// Storefront cart route — chooses between the block-rendered cart (when the
// vendor has a published system CART page) and the legacy hard-coded layout.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { useWishlist } from '@/lib/wishlist';
import { useVendor } from '@/lib/vendor-context';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import { CartBlockProvider } from '@/components/blocks/cart/CartContext';
import { LegacyVendorCartPage } from './LegacyCartLayout';

interface SystemPagePayload {
  id: string;
  vendorId: string;
  blocks: any[];
}

export default function VendorCartRoute() {
  const { vendor } = useVendor();
  const [systemPage, setSystemPage] = useState<SystemPagePayload | null | undefined>(undefined);

  useEffect(() => {
    api<SystemPagePayload>(`/api/storefront-pages/${vendor.id}/system/CART`, { auth: false, silent: true })
      .then((p) => setSystemPage(p))
      .catch(() => setSystemPage(null));
  }, [vendor.id]);

  if (systemPage === undefined) {
    return <div className="max-w-6xl mx-auto px-5 py-16 text-center text-ink-500">Loading…</div>;
  }
  if (systemPage === null) {
    return <LegacyVendorCartPage />;
  }
  return <BlockRenderedCart blocks={systemPage.blocks} />;
}

function BlockRenderedCart({ blocks }: { blocks: any[] }) {
  const router = useRouter();
  const { vendor, theme, storeKey } = useVendor();
  const { items: allItems, setQty, remove } = useCart();
  const addToWishlist = useWishlist((s) => s.add);

  const items = useMemo(
    () => allItems.filter((i) => !i.vendorId || i.vendorId === vendor.id),
    [allItems, vendor.id],
  );

  async function saveForLater(productId: string, variationComboId?: string) {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { toast.error('Sign in to save items for later'); return; }
    await addToWishlist(productId);
    remove(productId, variationComboId);
    toast.success('Moved to wishlist');
  }

  function proceedToCheckout() {
    router.push(`/store/${storeKey}/checkout`);
  }

  // Split the layout: announcement bar + line-items go in a main column, summary
  // floats in a right rail when present. Anything else (upsell, trust strip)
  // stacks below the main grid.
  const announcement  = blocks.filter((b) => b.type === 'cartAnnouncement');
  const summary       = blocks.filter((b) => b.type === 'cartSummary');
  const lineItems     = blocks.filter((b) => b.type === 'cartLineItems');
  const otherTop      = blocks.filter((b) => ['cartTrustStrip'].includes(b.type));
  const bottom        = blocks.filter((b) => ['cartUpsell'].includes(b.type));

  const ctx = { scope: 'vendor' as const, vendorId: vendor.id, pageKind: 'CART' as const };

  return (
    <CartBlockProvider
      storeKey={storeKey}
      vendorId={vendor.id}
      vendorName={vendor.shopName}
      theme={theme}
      items={items}
      setQty={setQty}
      remove={remove}
      saveForLater={saveForLater}
      proceedToCheckout={proceedToCheckout}
    >
      <div className="max-w-6xl mx-auto px-5 py-8">
        <BlockRenderer blocks={announcement} ctx={ctx} />

        <div className="flex items-baseline justify-between gap-4 mb-6">
          <h1 className="font-display text-3xl">Your cart</h1>
          <Link href={`/store/${storeKey}/products`} className="text-sm hover:underline">Continue shopping →</Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div>
            <BlockRenderer blocks={lineItems} ctx={ctx} />
            <BlockRenderer blocks={otherTop} ctx={ctx} />
          </div>
          <div>
            <BlockRenderer blocks={summary} ctx={ctx} />
          </div>
        </div>

        <BlockRenderer blocks={bottom} ctx={ctx} />
      </div>
    </CartBlockProvider>
  );
}
