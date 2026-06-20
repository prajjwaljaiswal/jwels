'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import {
  VendorProvider, VendorBrand, FONT_STACKS, useVendor, SocialPlatform,
} from '@/lib/vendor-context';
import { AccountMenu } from '@/components/storefront/AccountMenu';
import { SearchAutosuggest } from '@/components/search/SearchAutosuggest';

const ALGOLIA_READY =
  !!process.env.NEXT_PUBLIC_ALGOLIA_APP_ID && !!process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;

// Scroll-reveal transition duration per vendor-chosen animation speed.
const REVEAL_DURATION: Record<'slow' | 'normal' | 'fast', string> = {
  slow: '1200ms', normal: '800ms', fast: '450ms',
};

// Client shell for a vendor storefront. Receives the vendor brand from the RSC layout
// (server-fetched), so the themed markup is present in the initial SSR HTML — no FOUC and
// no client re-fetch. `isCustomHost` is forwarded so link base paths seed correctly.
export default function VendorStoreClient({
  vendor,
  isCustomHost,
  children,
}: {
  vendor: VendorBrand;
  isCustomHost: boolean;
  children: React.ReactNode;
}) {
  return (
    <VendorProvider vendor={vendor} isCustomHost={isCustomHost}>
      <ThemedShell>{children}</ThemedShell>
    </VendorProvider>
  );
}

function ThemedShell({ children }: { children: React.ReactNode }) {
  const { themeConfig: t } = useVendor();

  // Favicon and tab title are set server-side via the RSC layout's generateMetadata,
  // so they are correct on first byte (and for crawlers/social cards) — no client effects.

  const cssVars: React.CSSProperties & Record<string, string> = {
    '--store-color': t.colors.primary,
    '--store-accent': t.colors.accent,
    '--store-bg': t.colors.background,
    '--store-text': t.colors.text,
    '--store-header-bg': t.colors.headerBg,
    '--store-header-text': t.colors.headerText,
    '--store-footer-bg': t.colors.footerBg,
    '--store-footer-text': t.colors.footerText,
    '--store-heading-font': FONT_STACKS[t.typography.headingFont],
    '--store-body-font': FONT_STACKS[t.typography.bodyFont],
    '--reveal-duration': REVEAL_DURATION[t.animations?.speed ?? 'normal'],
    background: t.colors.background,
    color: t.colors.text,
    fontFamily: FONT_STACKS[t.typography.bodyFont],
  };

  const hoverFx = t.animations?.enabled && t.animations?.hover;

  return (
    <div className={`vendor-themed min-h-screen flex flex-col${hoverFx ? ' store-anim-hover' : ''}`} style={cssVars}>
      <ThemedTokensCss />
      <Header />
      <CategoryNav />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

// Re-resolve common Tailwind tokens (text-ink-*, bg-surface, bg-canvas, border-line,
// font-display) inside the storefront so every subpage automatically inherits the
// vendor's chosen palette and typography without per-file edits.
function ThemedTokensCss() {
  const css = `
    .vendor-themed { font-family: var(--store-body-font); }
    .vendor-themed h1,
    .vendor-themed h2,
    .vendor-themed h3,
    .vendor-themed h4,
    .vendor-themed .font-display { font-family: var(--store-heading-font); }

    .vendor-themed .text-ink-900 { color: var(--store-text); }
    .vendor-themed .text-ink-700 { color: color-mix(in srgb, var(--store-text) 75%, transparent); }
    .vendor-themed .text-ink-500 { color: color-mix(in srgb, var(--store-text) 55%, transparent); }
    .vendor-themed .text-ink-400 { color: color-mix(in srgb, var(--store-text) 40%, transparent); }

    .vendor-themed .bg-surface { background-color: color-mix(in srgb, var(--store-bg) 92%, white); }
    .vendor-themed .bg-canvas  { background-color: color-mix(in srgb, var(--store-bg) 88%, var(--store-text) 6%); }
    .vendor-themed .bg-white   { background-color: color-mix(in srgb, var(--store-bg) 96%, white); }

    .vendor-themed .border-line { border-color: color-mix(in srgb, var(--store-text) 14%, transparent); }
    .vendor-themed .divide-line > :not([hidden]) ~ :not([hidden]) { border-color: color-mix(in srgb, var(--store-text) 14%, transparent); }

    .vendor-themed .text-brand-600,
    .vendor-themed .text-brand-700 { color: var(--store-color); }
    .vendor-themed .bg-brand-600 { background-color: var(--store-color); }
    .vendor-themed .bg-brand-50  { background-color: color-mix(in srgb, var(--store-color) 12%, var(--store-bg)); }
    .vendor-themed .border-brand-600 { border-color: var(--store-color); }

    .vendor-themed .input-field {
      background: color-mix(in srgb, var(--store-bg) 96%, white);
      color: var(--store-text);
      border-color: color-mix(in srgb, var(--store-text) 18%, transparent);
    }
    .vendor-themed .input-field:focus {
      border-color: var(--store-color);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--store-color) 25%, transparent);
    }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

function Header() {
  const pathname = usePathname();
  const { vendor, themeConfig: t, theme, storeKey, basePath } = useVendor();
  const items = useCart((s) => s.items);
  const cartCount = items
    .filter((i) => !i.vendorId || i.vendorId === vendor.id)
    .reduce((s, i) => s + i.quantity, 0);
  const isStorefront = pathname === (basePath || '/');
  const navLinks = t.header.navLinks.length > 0
    ? t.header.navLinks
    : [{ label: 'Shop', href: (basePath || '/') }];

  return (
    <header
      className="sticky top-0 z-40 shadow-sm"
      style={{ background: t.colors.headerBg, color: t.colors.headerText, borderBottom: '1px solid rgba(0,0,0,0.08)' }}
    >
      {t.header.announcement && (
        <div
          className="text-center text-xs font-medium py-2 px-4"
          style={{ background: t.colors.primary, color: '#fff' }}
        >
          {t.header.announcement}
        </div>
      )}
      <div className="max-w-6xl mx-auto px-4 sm:px-5">
        <div className="h-16 flex items-center gap-3">
          <Link href={(basePath || '/')} className="flex items-center gap-3 min-w-0 shrink-0">
            {vendor.shopLogoUrl ? (
              // Bare logo — no circle/rectangle wrapper. Height & max-width come from
              // the vendor's theme (set in the dashboard); width stays auto. Logo is
              // capped a bit smaller on mobile so it never crowds the icons.
              <img
                src={vendor.shopLogoUrl}
                alt={vendor.shopName}
                className="w-auto object-contain shrink-0 max-h-10 sm:max-h-none"
                style={{ height: t.header.logoHeight ?? 48, maxWidth: t.header.logoMaxWidth || undefined }}
              />
            ) : (
              <div className="min-w-0">
                <p
                  className="text-base sm:text-lg leading-tight font-bold truncate"
                  style={{ color: theme, fontFamily: FONT_STACKS[t.typography.headingFont] }}
                >
                  {vendor.shopName}
                </p>
                {vendor.tagline && <p className="text-xs opacity-70 truncate hidden sm:block">{vendor.tagline}</p>}
              </div>
            )}
          </Link>

          {/* Inline search — tablet / desktop only */}
          {ALGOLIA_READY ? (
            <div className="hidden sm:flex flex-1 justify-center min-w-0">
              <SearchAutosuggest
                vendorId={vendor.id}
                searchBasePath={`${basePath}/products`}
                placeholder={`Search ${vendor.shopName}…`}
                className="w-full max-w-xl"
              />
            </div>
          ) : (
            <div className="hidden sm:block flex-1" />
          )}

          {isStorefront && (
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium shrink-0">
              {navLinks.map((l, i) => (
                <Link key={i} href={l.href} className="hover:opacity-70 transition-opacity">{l.label}</Link>
              ))}
            </nav>
          )}

          {/* Account + cart — pushed right on mobile (search lives on its own row) */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0" style={{ color: t.colors.headerText }}>
            <AccountMenu storeKey={storeKey} basePath={basePath} />
            <Link
              href={`${basePath}/cart`}
              className="relative h-10 w-10 rounded-full flex items-center justify-center border hover:opacity-80 transition-colors shrink-0"
              style={{ borderColor: 'rgba(0,0,0,0.15)' }}
              aria-label="Cart"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" />
                <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: theme }}>
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Full-width search row — mobile only */}
        {ALGOLIA_READY && (
          <div className="sm:hidden pb-3 -mt-1">
            <SearchAutosuggest
              vendorId={vendor.id}
              searchBasePath={`${basePath}/products`}
              placeholder={`Search ${vendor.shopName}…`}
              className="w-full"
            />
          </div>
        )}
      </div>
    </header>
  );
}

interface VendorCategory {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
}

function CategoryNav() {
  const { vendor, basePath, themeConfig: t, theme } = useVendor();
  const [cats, setCats] = useState<VendorCategory[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    api<VendorCategory[]>(`/api/vendors/${vendor.id}/categories`, { auth: false, silent: true })
      .then(setCats)
      .catch(() => setCats([]));
  }, [vendor.id]);

  if (!cats || cats.length === 0) return null;

  const productsBase = `${basePath}/products`;

  return (
    <nav
      className="border-b"
      style={{
        background: t.colors.headerBg,
        color: t.colors.headerText,
        borderColor: 'rgba(0,0,0,0.08)',
      }}
      onMouseLeave={() => setOpenId(null)}
    >
      <div className="max-w-6xl mx-auto px-5">
        <ul className="flex items-stretch gap-1 overflow-x-auto no-scrollbar text-sm font-medium">
          <li>
            <Link
              href={productsBase}
              className="flex items-center h-11 px-3 whitespace-nowrap hover:opacity-70 transition-opacity"
              style={{ color: theme }}
            >
              Shop all
            </Link>
          </li>
          {cats.map((c) => {
            const hasChildren = c.children.length > 0;
            const open = openId === c.id;
            return (
              <li
                key={c.id}
                className="relative"
                onMouseEnter={() => setOpenId(c.id)}
              >
                <Link
                  href={`${productsBase}?category=${c.slug}`}
                  className="flex items-center gap-1 h-11 px-3 whitespace-nowrap hover:opacity-70 transition-opacity"
                >
                  {c.name}
                  {hasChildren && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-60"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
                </Link>
                {hasChildren && open && (
                  <div
                    className="absolute left-0 top-full min-w-[200px] shadow-lg border rounded-md py-1 z-50"
                    style={{ background: t.colors.headerBg, borderColor: 'rgba(0,0,0,0.10)' }}
                  >
                    {c.children.map((s) => (
                      <Link
                        key={s.id}
                        href={`${productsBase}?category=${s.slug}`}
                        className="block px-4 py-2 text-sm whitespace-nowrap hover:bg-canvas"
                        onClick={() => setOpenId(null)}
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function Footer() {
  const { vendor, themeConfig: t, theme } = useVendor();
  const hasColumns = t.footer.columns.length > 0;
  const hasSocials = t.footer.socials.length > 0;
  const hasContact = t.footer.contactEmail || t.footer.contactPhone;
  const hasAbout = t.footer.about.length > 0;
  const hasRich = hasColumns || hasSocials || hasContact || hasAbout;

  return (
    <footer style={{ background: t.colors.footerBg, color: t.colors.footerText, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
      {hasRich && (
        <div className="max-w-6xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {vendor.shopLogoUrl
                ? <img src={vendor.shopLogoUrl} alt="" className="h-12 w-auto max-w-[140px] object-contain" />
                : <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: theme }}>{vendor.shopName[0]}</div>}
              <span className="font-semibold" style={{ color: theme, fontFamily: FONT_STACKS[t.typography.headingFont] }}>{vendor.shopName}</span>
            </div>
            {hasAbout && <p className="text-xs leading-relaxed opacity-80">{t.footer.about}</p>}
            {hasSocials && (
              <div className="flex items-center gap-2 pt-1">
                {t.footer.socials.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="h-8 w-8 rounded-full flex items-center justify-center hover:opacity-70" style={{ background: 'rgba(0,0,0,0.06)' }}>
                    <SocialIcon platform={s.platform} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {t.footer.columns.map((col, i) => (
            <div key={i}>
              <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-70">{col.title}</p>
              <ul className="space-y-1.5 text-xs">
                {col.links.map((l, j) => (
                  <li key={j}><a href={l.href} className="hover:underline">{l.label}</a></li>
                ))}
              </ul>
            </div>
          ))}

          {hasContact && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2 opacity-70">Contact</p>
              <ul className="space-y-1.5 text-xs">
                {t.footer.contactEmail && <li><a href={`mailto:${t.footer.contactEmail}`} className="hover:underline">{t.footer.contactEmail}</a></li>}
                {t.footer.contactPhone && <li><a href={`tel:${t.footer.contactPhone}`} className="hover:underline">{t.footer.contactPhone}</a></li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs opacity-70">
          <span>{t.footer.copyright || `© ${new Date().getFullYear()} ${vendor.shopName}. All rights reserved.`}</span>
          <span>Powered by <a href={`${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}`} className="hover:underline">Vrindaonline Marketplace</a></span>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor' } as const;
  switch (platform) {
    case 'instagram':
      return <svg {...common}><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.8.2 2.2.4.6.2 1 .5 1.5 1s.7.9 1 1.5c.2.4.4 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.5s-.9.7-1.5 1c-.4.2-1 .4-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.8-.2-2.2-.4-.6-.2-1-.5-1.5-1s-.7-.9-1-1.5c-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c0-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.5s.9-.7 1.5-1c.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.7.1-1.1 0-1.6.2-2 .3-.5.2-.9.4-1.2.8s-.6.7-.8 1.2c-.1.4-.3.9-.3 2C2.9 9.5 2.9 9.9 2.9 13s0 3.5.1 4.7c0 1.1.2 1.6.3 2 .2.5.4.9.8 1.2s.7.6 1.2.8c.4.1.9.3 2 .3 1.1.1 1.5.1 4.7.1s3.5 0 4.7-.1c1.1 0 1.6-.2 2-.3.5-.2.9-.4 1.2-.8s.6-.7.8-1.2c.1-.4.3-.9.3-2 .1-1.1.1-1.5.1-4.7s0-3.5-.1-4.7c0-1.1-.2-1.6-.3-2-.2-.5-.4-.9-.8-1.2s-.7-.6-1.2-.8c-.4-.1-.9-.3-2-.3C15.5 4 15.1 4 12 4zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-2.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>;
    case 'facebook':
      return <svg {...common}><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.5 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg>;
    case 'twitter':
      return <svg {...common}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
    case 'youtube':
      return <svg {...common}><path d="M23 12s0-3.5-.5-5.2c-.2-.9-.9-1.6-1.8-1.9C19 4.5 12 4.5 12 4.5s-7 0-8.7.4c-.9.3-1.6 1-1.8 1.9C1 8.5 1 12 1 12s0 3.5.5 5.2c.2.9.9 1.6 1.8 1.9 1.7.4 8.7.4 8.7.4s7 0 8.7-.4c.9-.3 1.6-1 1.8-1.9.5-1.7.5-5.2.5-5.2zM10 15.5v-7l6 3.5z"/></svg>;
    case 'whatsapp':
      return <svg {...common}><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.7.1-.8.9-.9 1.1-.3.1-.5 0c-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.2-.5s0-.4-.1-.5c-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1.1 2.8 1.2 3c.1.2 2.1 3.3 5.2 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.5.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>;
    case 'pinterest':
      return <svg {...common}><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9.2-.8 1.1-4.7 1.1-4.7s-.3-.6-.3-1.4c0-1.4.8-2.4 1.8-2.4.8 0 1.2.6 1.2 1.4 0 .8-.5 2.1-.8 3.2-.2.9.5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.7-3.9-4-3.9-2.8 0-4.4 2.1-4.4 4.2 0 .8.3 1.7.7 2.2.1.1.1.2.1.3l-.3 1.1c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.4 2.6 6.4 6 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2-.6-2.4-1.2l-.6 2.4c-.2.9-.8 2-1.3 2.7A10 10 0 1 0 12 2z"/></svg>;
    case 'tiktok':
      return <svg {...common}><path d="M19.6 6.7a5 5 0 0 1-3-1.5 5 5 0 0 1-1.4-2.9V2h-3.4v13.5a2.7 2.7 0 1 1-2-2.6V9.5a6 6 0 0 0-1-.1 6 6 0 1 0 6 6V8.7a8.4 8.4 0 0 0 4.8 1.5z"/></svg>;
    case 'linkedin':
      return <svg {...common}><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.3 18.3v-8.5H5.5v8.5zM6.9 8.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm11.4 9.7v-4.7c0-2.5-1.4-3.7-3.2-3.7a2.7 2.7 0 0 0-2.5 1.4v-1.2H9.8c0 .8.1 8.5 0 8.5h2.8v-4.7c0-.3 0-.5.1-.7.2-.5.6-1 1.4-1 1 0 1.4.8 1.4 1.9v4.5z"/></svg>;
  }
}
