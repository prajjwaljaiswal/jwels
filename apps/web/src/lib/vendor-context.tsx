'use client';
import { createContext, useContext, useMemo } from 'react';

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
  };
}

const VendorContext = createContext<VendorContextValue | null>(null);

export function VendorProvider({ vendor, children }: { vendor: VendorBrand; children: React.ReactNode }) {
  const theme = vendor.themeColor ?? '#F1641E';
  const themeConfig = useMemo(() => mergeTheme(theme, vendor.theme), [theme, vendor.theme]);
  const storeKey = vendor.slug || vendor.id;
  return (
    <VendorContext.Provider value={{ vendor, theme, themeConfig, storeKey }}>
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error('useVendor must be used within VendorProvider');
  return ctx;
}

export const FONT_STACKS: Record<string, string> = {
  serif:   '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  sans:    '"Inter", "Helvetica Neue", Arial, sans-serif',
  display: '"Fraunces", "Cormorant Garamond", Georgia, serif',
};
