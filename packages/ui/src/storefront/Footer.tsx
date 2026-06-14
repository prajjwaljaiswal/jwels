'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';

const COLS = [
  {
    title: 'Shop',
    links: [
      { label: 'All jewelry', href: '/products' },
      { label: 'Necklaces', href: '/products?category=necklaces' },
      { label: 'Earrings', href: '/products?category=earrings' },
      { label: 'Rings', href: '/products?category=rings' },
      { label: 'Bridal', href: '/products?category=bridal' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { label: 'Become a vendor', href: '/auth/register?role=vendor' },
      { label: 'Vendor dashboard', href: '/vendor' },
      { label: 'Vendor handbook', href: '#' },
      { label: 'Fees & payouts', href: '#' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Order status', href: '/orders' },
      { label: 'Returns', href: '#' },
      { label: 'Shipping', href: '#' },
      { label: 'Contact us', href: '#' },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'Our story', href: '#' },
      { label: 'Hallmarking', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Careers', href: '#' },
    ],
  },
];

export function Footer() {
  const pathname = usePathname() || '';
  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="max-w-container mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-ink-900 mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-ink-700 hover:text-brand-700 hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo markClassName="h-7 w-7" textClassName="font-display text-2xl text-brand-600" />
            <span className="text-xs text-ink-500">Handcrafted marketplace · India</span>
          </div>
          <div className="text-xs text-ink-500">© {new Date().getFullYear()} Vrindaonline Marketplace. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
