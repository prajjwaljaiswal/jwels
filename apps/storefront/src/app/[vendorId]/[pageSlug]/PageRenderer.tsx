'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useVendor, useStoreReveal } from '@/lib/vendor-context';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import VendorProductDetailRoute from '../products/[id]/ProductDetailClient';
import type { Block } from '@/components/blocks/types';

interface PublishedPage {
  id: string;
  vendorId: string;
  slug: string;
  title: string;
  blocks: Block[];
}

export default function PageRenderer() {
  const { pageSlug } = useParams<{ pageSlug: string }>();
  const { vendor } = useVendor();
  const reveal = useStoreReveal();
  const [page, setPage] = useState<PublishedPage | null>(null);
  const [isProduct, setIsProduct] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setPage(null);
    setIsProduct(false);
    setNotFound(false);

    api<PublishedPage>(`/api/storefront-pages/${vendor.id}/${pageSlug}`, { auth: false, silent: true })
      .then(setPage)
      .catch(() => {
        // Not a custom page — check if it's a product slug.
        api(`/api/products/${pageSlug}`, { auth: false, silent: true })
          .then(() => setIsProduct(true))
          .catch(() => setNotFound(true));
      });
  }, [vendor.id, pageSlug]);

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-ink-600">This shop doesn't have a page at /{pageSlug}.</p>
      </div>
    );
  }

  if (isProduct) return <VendorProductDetailRoute params={{ vendorId: vendor.id, id: pageSlug }} />;

  if (!page) return <div className="px-6 py-20 text-center text-ink-500">Loading…</div>;

  return <BlockRenderer blocks={Array.isArray(page.blocks) ? page.blocks : []} ctx={{ scope: 'vendor', vendorId: vendor.id }} reveal={reveal} />;
}
