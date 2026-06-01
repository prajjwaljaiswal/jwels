import type { Metadata } from 'next';
import PageRenderer from './PageRenderer';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PageMeta {
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageUrl: string | null;
}

async function fetchPageMeta(vendorId: string, slug: string): Promise<PageMeta | null> {
  try {
    const res = await fetch(`${API}/api/storefront-pages/${vendorId}/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PageMeta;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { vendorId: string; pageSlug: string };
}): Promise<Metadata> {
  const meta = await fetchPageMeta(params.vendorId, params.pageSlug);
  if (!meta) return { title: 'Page not found' };
  const title = meta.seoTitle || meta.title;
  const description = meta.seoDescription || undefined;
  const images = meta.seoImageUrl ? [{ url: meta.seoImageUrl }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: 'summary_large_image', title, description, images: meta.seoImageUrl ? [meta.seoImageUrl] : undefined },
  };
}

export default function Page() {
  return <PageRenderer />;
}
