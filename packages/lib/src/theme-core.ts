// Pure, framework-agnostic theme helpers + types for vendor storefronts.
//
// IMPORTANT: NO 'use client' and NO React imports here. This module is imported by
// BOTH React Server Components (the storefront [vendorId] layout, for server-side theme
// + metadata) and client components. vendor-context.tsx re-exports everything below so
// existing client imports (`@/lib/vendor-context`, `@jewel/lib`) keep resolving unchanged.

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

export type StoreReveal = { direction: 'up' | 'left' | 'right' | 'zoom' | 'fade'; stagger: boolean };

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

export const FONT_STACKS: Record<string, string> = {
  serif:   '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  sans:    '"Inter", "Helvetica Neue", Arial, sans-serif',
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
};
