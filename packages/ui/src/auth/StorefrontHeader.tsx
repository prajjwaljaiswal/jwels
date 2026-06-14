'use client';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { FONT_STACKS, type VendorBrand, type VendorTheme } from '@/lib/vendor-context';

interface Props {
  vendor: VendorBrand | null;
  themeConfig: VendorTheme;
  vendorKey: string;
}

export function StorefrontHeader({ vendor, themeConfig: t, vendorKey }: Props) {
  const primary = t.colors.primary;
  const items = useCart((s) => s.items);
  const cartCount = items
    .filter((i) => !vendor || !i.vendorId || i.vendorId === vendor.id)
    .reduce((s, i) => s + i.quantity, 0);

  return (
    <header
      className="sticky top-0 z-40 shadow-sm"
      style={{ background: t.colors.headerBg, color: t.colors.headerText, borderBottom: '1px solid rgba(0,0,0,0.08)' }}
    >
      {t.header.announcement && (
        <div className="text-center text-xs font-medium py-2 px-4" style={{ background: primary, color: '#fff' }}>
          {t.header.announcement}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-4">
        {vendorKey ? (
          <Link href={`/${vendorKey}`} className="flex items-center gap-3 min-w-0">
            {vendor?.shopLogoUrl ? (
              <img
                src={vendor.shopLogoUrl}
                alt={vendor.shopName}
                className="h-10 w-10 rounded-full object-cover border shrink-0"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              />
            ) : (
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ background: primary }}
              >
                {vendor ? vendor.shopName[0].toUpperCase() : vendorKey[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p
                className="text-lg leading-tight font-bold truncate"
                style={{ color: primary, fontFamily: FONT_STACKS[t.typography.headingFont] }}
              >
                {vendor?.shopName ?? vendorKey}
              </p>
              {vendor?.tagline && (
                <p className="text-xs opacity-70 truncate hidden sm:block">{vendor.tagline}</p>
              )}
            </div>
          </Link>
        ) : (
          <span className="font-bold text-xl" style={{ color: primary }}>Vrindaonline</span>
        )}

        <div className="flex-1" />

        {vendorKey && (
          <Link
            href={`/${vendorKey}/cart`}
            className="relative h-10 w-10 rounded-full flex items-center justify-center border hover:opacity-80 transition-colors shrink-0"
            style={{ borderColor: 'rgba(0,0,0,0.15)', color: t.colors.headerText }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
              <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
            </svg>
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ background: primary }}
              >
                {cartCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}
