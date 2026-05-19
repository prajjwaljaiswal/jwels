'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardShell, Icons, type NavItem } from '@/components/dashboard/DashboardShell';
import { ProfileMenu } from '@/components/dashboard/ProfileMenu';
import { useMe } from '@/lib/permissions';
import { setToken } from '@/lib/api';

const NAV: NavItem[] = [
  { label: 'Dashboard',       href: '/',               icon: Icons.Home,     match: (p) => p === '/' },
  { label: 'Analytics',       href: '/analytics',      icon: Icons.Chart,    match: (p) => p.startsWith('/analytics') },
  { label: 'Listings',        href: '/products/new',   icon: Icons.Tag,      match: (p) => p.startsWith('/products') },
  { label: 'Sections',        href: '/sections',       icon: Icons.Layers,   match: (p) => p.startsWith('/sections') },
  { label: 'Categories',      href: '/categories',     icon: Icons.Layers,   match: (p) => p.startsWith('/categories') },
  { label: 'Pages',           href: '/pages',          icon: Icons.Layers,   match: (p) => p.startsWith('/pages') },
  { label: 'Storefront',      href: '/storefront',     icon: Icons.Star,     match: (p) => p.startsWith('/storefront') },
  { label: 'Return policies', href: '/policies',       icon: Icons.Settings, match: (p) => p.startsWith('/policies') },
  { label: 'Orders',          href: '/orders',         icon: Icons.Box,      match: (p) => p.startsWith('/orders') },
  { label: 'Coupons',         href: '/coupons',        icon: Icons.Tag,      match: (p) => p.startsWith('/coupons') },
  { label: 'Reviews',         href: '/reviews',        icon: Icons.Star,     match: (p) => p.startsWith('/reviews') },
  { label: 'Payouts',         href: '/payouts',        icon: Icons.Wallet,   match: (p) => p.startsWith('/payouts') },
  { label: 'Payment methods', href: '/payments',       icon: Icons.Wallet,   match: (p) => p.startsWith('/payments') },
  { label: 'Shipping',        href: '/shipping',       icon: Icons.Box,      match: (p) => p.startsWith('/shipping') },
  { label: 'Settings',        href: '/settings',       icon: Icons.Settings, match: (p) => p.startsWith('/settings') },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading) return;
    if (!me) { router.replace('/auth/login'); return; }
    if (me.role !== 'VENDOR') { setToken(null); router.replace('/auth/login'); }
  }, [me, loading, router]);

  if (loading || !me || me.role !== 'VENDOR') {
    return <div className="min-h-screen bg-canvas" />;
  }

  return (
    <DashboardShell
      brand={{ title: 'Vendor', subtitle: 'Shop manager', href: '/' }}
      nav={NAV}
      topRight={
        <div className="flex items-center gap-2">
          <Link href="/storefront" className="hidden md:inline text-sm text-ink-700 hover:text-brand-700">
            Storefront ↗
          </Link>
          <button className="h-9 w-9 rounded-md hover:bg-canvas flex items-center justify-center text-ink-700" aria-label="Notifications">
            {Icons.Bell}
          </button>
          <ProfileMenu variant="vendor" />
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
