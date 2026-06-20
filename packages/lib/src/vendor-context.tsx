'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { mergeTheme, type VendorTheme, type VendorBrand, type StoreReveal } from './theme-core';

// Re-export the pure theme helpers + types from theme-core so existing imports
// (`@/lib/vendor-context`, `@jewel/lib`, packages/ui) keep resolving unchanged. The
// React Server Component storefront layout imports these from './theme-core' directly
// (it cannot import this 'use client' module).
export { defaultTheme, mergeTheme, FONT_STACKS } from './theme-core';
export type {
  SocialPlatform,
  NavLink,
  FooterColumn,
  SocialLink,
  VendorTheme,
  VendorBrand,
  StoreReveal,
} from './theme-core';

interface VendorContextValue {
  vendor: VendorBrand;
  theme: string;          // legacy primary color shortcut
  themeConfig: VendorTheme;
  storeKey: string;       // slug ?? id — used to build canonical SEO URLs
  basePath: string;       // link prefix: "" on a custom/subdomain host, "/<storeKey>" on the shared app domain / localhost
}

/**
 * Resolves the path prefix to use when building in-store links.
 *
 *  - On a tenant host (custom domain or {slug}.<app-domain>) the storefront middleware
 *    rewrites "/x" → "/<slug>/x", so links must be slug-LESS ("" prefix) to keep the
 *    address bar clean — jhumkaya.com/product-slug, not jhumkaya.com/jhumkaya/product-slug.
 *  - On localhost or the shared app domain vendors are reached path-first, so links keep
 *    the "/<slug>" prefix.
 *
 * When `isCustomHost` is provided (the server already classified the host), the initial
 * state is seeded to match — so the first client render equals the server-rendered HTML
 * with no hydration flip. When omitted (legacy/path access), it falls back to detecting
 * the host after mount.
 */
export function useStoreBasePath(storeKey: string, isCustomHost?: boolean): string {
  const seed = isCustomHost === undefined ? `/${storeKey}` : isCustomHost ? '' : `/${storeKey}`;
  const [basePath, setBasePath] = useState(seed);
  useEffect(() => {
    if (isCustomHost !== undefined) {
      setBasePath(isCustomHost ? '' : `/${storeKey}`);
      return;
    }
    const host = window.location.hostname;
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost';
    const pathBased =
      host === appDomain || host === 'localhost' || host.endsWith('.localhost');
    setBasePath(pathBased ? `/${storeKey}` : '');
  }, [storeKey, isCustomHost]);
  return basePath;
}

const VendorContext = createContext<VendorContextValue | null>(null);

export function VendorProvider({
  vendor,
  isCustomHost,
  children,
}: {
  vendor: VendorBrand;
  isCustomHost?: boolean;
  children: React.ReactNode;
}) {
  const theme = vendor.themeColor ?? '#F1641E';
  const themeConfig = useMemo(() => mergeTheme(theme, vendor.theme), [theme, vendor.theme]);
  const storeKey = vendor.slug || vendor.id;
  const basePath = useStoreBasePath(storeKey, isCustomHost);
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
