import type { Metadata } from 'next';
import ProductDetailClient from './ProductDetailClient';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function generateMetadata({
  params,
}: {
  params: { vendorId: string; id: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(`${API}/api/products/${encodeURIComponent(params.id)}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const product = await res.json();
      const title = product.name as string;
      const description = (product.description as string | null) ?? undefined;
      const image = product.images?.[0] as string | undefined;
      return {
        title,
        description,
        openGraph: {
          title,
          description,
          images: image ? [{ url: image }] : undefined,
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: image ? [image] : undefined,
        },
      };
    }
  } catch {}
  return { title: 'Product' };
}

export default function Page({ params }: { params: { vendorId: string; id: string } }) {
  return <ProductDetailClient params={params} />;
}
