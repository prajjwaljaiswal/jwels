'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type SocialPlatform =
  | 'instagram' | 'facebook' | 'twitter' | 'youtube'
  | 'whatsapp' | 'pinterest' | 'tiktok' | 'linkedin';

export interface NavLink { label: string; href: string }
export interface FooterColumn { title: string; links: NavLink[] }
export interface SocialLink { platform: SocialPlatform; url: string }

export interface VendorTheme {
  colors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    headerBg: string;
    headerText: string;
    footerBg: string;
    footerText: string;
  };
  typography: {
    headingFont: 'serif' | 'sans' | 'display';
    bodyFont: 'serif' | 'sans';
  };
  header: {
    announcement: string;
    showSearch: boolean;
    showMarketplaceLink: boolean;
    logoHeight?: number;     // logo render height in px (defaults to 48)
    logoMaxWidth?: number;   // optional max-width cap in px (logo width stays auto)
    navLinks: NavLink[];
  };
  footer: {
    about: string;
    columns: FooterColumn[];
    socials: SocialLink[];
    contactEmail: string;
    contactPhone: string;
    copyright: string;
  };
  faviconUrl?: string;      // vendor-uploaded favicon (empty/undefined = browser default)
  animations?: {
    enabled: boolean;       // scroll-reveal sections as they enter the viewport
    style: 'fade' | 'fade-up' | 'left' | 'right' | 'zoom';
    speed: 'slow' | 'normal' | 'fast';
    stagger: boolean;       // stagger the reveal of consecutive sections
    hover: boolean;         // gentle image zoom on hover (product / category cards)
  };
}

export interface VendorBrand {
  id: string;
  slug?: string | null;
  shopName: string;
  shopLogoUrl: string | null;
  bannerUrls: string[];
  tagline: string | null;
  description: string | null;
  themeColor: string | null;
  theme?: Partial<VendorTheme> | null;
}

interface VendorContextValue {
  vendor: VendorBrand;
  theme: string;          // legacy primary color shortcut
  themeConfig: VendorTheme;
  storeKey: string;       // slug ?? id — used to build canonical SEO URLs
  basePath: string;       // link prefix: "" on a custom domain, "/<storeKey>" on the shared app domain / localhost
}

/**
 * Resolves the path prefix to use when building in-store links.
 *
 *  - On a custom vendor domain (e.g. jhumkaya.com) the storefront middleware
 *    rewrites "/x" → "/<slug>/x", so links must be slug-LESS ("" prefix) to keep
 *    the address bar clean — jhumkaya.com/product-slug, not jhumkaya.com/jhumkaya/product-slug.
 *  - On localhost or the shared app domain (store.vrindaonline.com) vendors are
 *    reached path-first, so links keep the "/<slug>" prefix.
 *
 * SSR and the first client render both return the path-based form (matching the
 * server-rendered HTML) to avoid a hydration mismatch; on a custom domain it then
 * flips to the clean form right after mount, before any link is clicked.
 */
export function useStoreBasePath(storeKey: string): string {
  const [basePath, setBasePath] = useState(`/${storeKey}`);
  useEffect(() => {
    const host = window.location.hostname;
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost';
    const pathBased =
      host === appDomain || host === 'localhost' || host.endsWith('.localhost');
    setBasePath(pathBased ? `/${storeKey}` : '');
  }, [storeKey]);
  return basePath;
}

export function defaultTheme(primary = '#F1641E'): VendorTheme {
  return {
    colors: {
      primary,
      accent:     primary,
      background: '#FFFFFF',
      text:       '#222222',
      headerBg:   '#FFFFFF',
      headerText: '#222222',
      footerBg:   '#FAFAFA',
      footerText: '#4B5563',
    },
    typography: { headingFont: 'display', bodyFont: 'sans' },
    header: {
      announcement: '',
      showSearch: false,
      showMarketplaceLink: true,
      logoHeight: 48,
      logoMaxWidth: 200,
      navLinks: [],
    },
    footer: {
      about: '',
      columns: [],
      socials: [],
      contactEmail: '',
      contactPhone: '',
      copyright: '',
    },
    faviconUrl: '',
    animations: {
      enabled: true,
      style: 'fade-up',
      speed: 'normal',
      stagger: true,
      hover: true,
    },
  };
}

export function mergeTheme(primary: string, partial?: Partial<VendorTheme> | null): VendorTheme {
  const base = defaultTheme(primary);
  if (!partial) return base;
  return {
    colors:     { ...base.colors,     ...(partial.colors     ?? {}) },
    typography: { ...base.typography, ...(partial.typography ?? {}) },
    header:     { ...base.header,     ...(partial.header     ?? {}) },
    footer:     { ...base.footer,     ...(partial.footer     ?? {}) },
    faviconUrl: partial.faviconUrl ?? base.faviconUrl,
    animations: { ...base.animations!, ...(partial.animations ?? {}) },
  };
}

const VendorContext = createContext<VendorContextValue | null>(null);

export function VendorProvider({ vendor, children }: { vendor: VendorBrand; children: React.ReactNode }) {
  const theme = vendor.themeColor ?? '#F1641E';
  const themeConfig = useMemo(() => mergeTheme(theme, vendor.theme), [theme, vendor.theme]);
  const storeKey = vendor.slug || vendor.id;
  const basePath = useStoreBasePath(storeKey);
  return (
    <VendorContext.Provider value={{ vendor, theme, themeConfig, storeKey, basePath }}>
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendor must be used within VendorProvider');
  return ctx;
}

export type StoreReveal = { direction: 'up' | 'left' | 'right' | 'zoom' | 'fade'; stagger: boolean };

const REVEAL_STYLE_TO_DIR: Record<string, StoreReveal['direction']> = {
  'fade': 'fade', 'fade-up': 'up', 'left': 'left', 'right': 'right', 'zoom': 'zoom',
};

/**
 * Resolves the vendor's animation settings into a reveal config for BlockRenderer,
 * or null when animations are disabled. Shared by the homepage, PDP, and custom pages.
 */
export function useStoreReveal(): StoreReveal | null {
  const { themeConfig } = useVendor();
  const a = themeConfig.animations;
  if (!a?.enabled) return null;
  return { direction: REVEAL_STYLE_TO_DIR[a.style] ?? 'up', stagger: a.stagger };
}

export const FONT_STACKS: Record<string, string> = {
  serif:   '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  sans:    '"Inter", "Helvetica Neue", Arial, sans-serif',
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
};
