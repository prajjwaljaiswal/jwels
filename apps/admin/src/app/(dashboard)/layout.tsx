'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardShell, Icons, type NavItem } from '@/components/dashboard/DashboardShell';
import { ProfileMenu } from '@/components/dashboard/ProfileMenu';
import { NotificationBell } from '@/components/support/NotificationBell';
import { useMe, usePermissions, type Permission } from '@/lib/permissions';
import { NotificationsProvider } from '@/lib/realtime/NotificationsProvider';
import { setToken } from '@/lib/api';

const NAV: Array<NavItem & { perm?: Permission | Permission[] }> = [
  { label: 'Overview',            href: '/',                   icon: Icons.Chart,   match: (p) => p === '/' },
  { label: 'Orders',              href: '/orders',             icon: Icons.Wallet,  match: (p) => p.startsWith('/orders'),    perm: 'ORDER_VIEW' },
  { label: 'Moderation',          href: '/moderation',         icon: Icons.Layers,  match: (p) => p.startsWith('/moderation'),perm: 'PRODUCT_VIEW' },
  { label: 'Support',             href: '/support',            icon: Icons.Bell,    match: (p) => p.startsWith('/support'),   perm: 'SUPPORT_VIEW' },
  { label: 'Returns & disputes',  href: '/returns',            icon: Icons.Layers,  match: (p) => p.startsWith('/returns'),   perm: 'RETURN_MANAGE' },
  { label: 'Vendor approvals',    href: '/vendors',            icon: Icons.Users,   match: (p) => p.startsWith('/vendors'),   perm: 'VENDOR_VIEW' },
  { label: 'KYC review',          href: '/kyc',                icon: Icons.Users,   match: (p) => p.startsWith('/kyc'),       perm: 'VENDOR_APPROVE' },
  { label: 'Categories',          href: '/categories',         icon: Icons.Layers,  match: (p) => p === '/categories' || (p.startsWith('/categories/') && !p.startsWith('/categories/proposed')), perm: 'CATEGORY_MANAGE' },
  { label: 'Category proposals',  href: '/categories/proposed',icon: Icons.Layers,  match: (p) => p.startsWith('/categories/proposed'), perm: 'CATEGORY_MANAGE' },
  { label: 'Collections',         href: '/collections',        icon: Icons.Layers,  match: (p) => p.startsWith('/collections'), perm: 'CATEGORY_MANAGE' },
  { label: 'Payouts',             href: '/payouts',            icon: Icons.Wallet,  match: (p) => p.startsWith('/payouts'),   perm: 'PAYOUT_VIEW' },
  { label: 'Payment methods',     href: '/payments',           icon: Icons.Wallet,  match: (p) => p.startsWith('/payments'),  perm: 'PAYMENT_METHOD_VIEW' },
  { label: 'Settings',            href: '/settings',           icon: Icons.Settings,match: (p) => p.startsWith('/settings'), perm: 'SETTINGS_MANAGE' },
  { label: 'Access control',      href: '/rbac/roles',         icon: Icons.Users,   match: (p) => p.startsWith('/rbac'),      perm: 'RBAC_MANAGE' },
  { label: 'Audit log',           href: '/rbac/audit',         icon: Icons.Chart,   match: (p) => p.startsWith('/rbac/audit'),perm: 'AUDIT_VIEW' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me, loading: meLoading } = useMe();

  useEffect(() => {
    if (meLoading) return;
    if (!me) { router.replace('/auth/login'); return; }
    if (me.role !== 'ADMIN') { setToken(null); router.replace('/auth/login'); }
  }, [me, meLoading, router]);

  const { has, loading } = usePermissions();

  if (meLoading || !me || me.role !== 'ADMIN') {
    return <div className="min-h-screen bg-canvas" />;
  }

  const nav: NavItem[] = NAV.filter((item) => {
    if (!item.perm) return true;
    if (loading) return false;
    const perms = Array.isArray(item.perm) ? item.perm : [item.perm];
    return perms.some((p) => has(p));
  }).map(({ perm, ...rest }) => rest);

  return (
    <NotificationsProvider>
      <DashboardShell
        brand={{ eyebrow: 'Admin', title: 'Operations console', href: '/' }}
        nav={nav}
        topRight={
          <div className="flex items-center gap-2">
            <Link href="/" className="hidden md:inline text-sm text-ink-700 hover:text-brand-700">
              Storefront ↗
            </Link>
            <NotificationBell baseHref="/support" pathTemplate="/support/{id}" />
            <ProfileMenu variant="admin" />
          </div>
        }
      >
        {children}
      </DashboardShell>
    </NotificationsProvider>
  );
}
