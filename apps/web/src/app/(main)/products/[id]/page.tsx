'use client';
import { ProductDetailView } from '@/components/products/ProductDetailView';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  return <ProductDetailView productId={params.id} />;
}
