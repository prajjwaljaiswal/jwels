'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';

// Vendor-focused footer. No consumer shop links — selling is the whole story here.
const COLS = [
  {
    title: 'Sell',
    links: [
      { label: 'Start selling', href: '/sell/register' },
      { label: 'Log in', href: '/sell/login' },
      { label: 'How it works', href: '/how-it-works' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Vendor handbook', href: '#' },
      { label: 'Fees & payouts', href: '#' },
      { label: 'Shipping & returns', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Our story', href: '#' },
      { label: 'Contact', href: '#' },
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
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
            <span className="text-xs text-ink-500">Your branded jewellery store · India</span>
          </div>
          <div className="text-xs text-ink-500">© {new Date().getFullYear()} Vrindaonline. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
