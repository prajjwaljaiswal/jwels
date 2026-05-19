import type { Metadata } from 'next';
import StorefrontHome from './StorefrontHome';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface VendorBrandSummary {
  shopName: string;
  tagline: string | null;
  description: string | null;
  shopLogoUrl: string | null;
  bannerUrls: string[];
}

interface PageMeta {
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageUrl: string | null;
}

async function fetchVendor(vendorId: string): Promise<VendorBrandSummary | null> {
  try {
    const res = await fetch(`${API}/api/vendors/${vendorId}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.vendor ?? null;
  } catch {
    return null;
  }
}

async function fetchHomepage(vendorId: string): Promise<PageMeta | null> {
  try {
    const res = await fetch(`${API}/api/storefront-pages/${vendorId}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as PageMeta;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { vendorId: string };
}): Promise<Metadata> {
  const [vendor, home] = await Promise.all([
    fetchVendor(params.vendorId),
    fetchHomepage(params.vendorId),
  ]);

  if (!vendor) return { title: 'Shop not found' };

  const title = home?.seoTitle || `${vendor.shopName}${vendor.tagline ? ` — ${vendor.tagline}` : ''}`;
  const description =
    home?.seoDescription || vendor.tagline || vendor.description || `Shop ${vendor.shopName} on Jewel Marketplace.`;
  const imageUrl = home?.seoImageUrl || vendor.bannerUrls?.[0] || vendor.shopLogoUrl || undefined;
  const images = imageUrl ? [{ url: imageUrl }] : undefined;

  return {
    title,
    description,
    openGraph: { title, description, images, type: 'website' },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function Page() {
  return <StorefrontHome />;
}
