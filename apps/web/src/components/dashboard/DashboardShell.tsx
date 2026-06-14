'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  match?: (pathname: string) => boolean;
}

interface ShellProps {
  brand: { eyebrow?: string; title: string; subtitle?: string; href: string };
  nav: NavItem[];
  topRight?: ReactNode;
  children: ReactNode;
}

export function DashboardShell({ brand, nav, topRight, children }: ShellProps) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 bg-surface border-b border-line">
        <div className="flex items-center h-14 px-4 gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="md:hidden h-9 w-9 rounded-md hover:bg-canvas flex items-center justify-center"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <Link href={brand.href} className="flex items-center gap-2 mr-auto">
            {brand.eyebrow && (
              <span className="hidden md:inline text-[10px] font-bold tracking-[0.2em] uppercase text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                {brand.eyebrow}
              </span>
            )}
            <Logo markClassName="h-7 w-7" textClassName="font-display text-2xl text-brand-600 leading-none" />
            <span className="hidden md:inline text-sm text-ink-700 border-l border-line pl-2 ml-1">
              {brand.title}
            </span>
          </Link>

          {topRight}
        </div>
      </header>

      <div className="flex">
        {/* SIDEBAR */}
        <aside
          className={[
            'fixed md:static z-40 inset-y-0 left-0 top-14 md:top-0',
            'w-60 bg-surface border-r border-line p-3',
            'md:min-h-[calc(100vh-3.5rem)]',
            'transition-transform',
            open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          ].join(' ')}
        >
          {brand.subtitle && (
            <div className="px-3 pt-2 pb-4 border-b border-line mb-3">
              <p className="text-xs text-ink-500">Workspace</p>
              <p className="text-sm font-semibold text-ink-900 truncate">{brand.subtitle}</p>
            </div>
          )}
          <nav className="space-y-0.5">
            {nav.map((item) => {
              const active = item.match ? item.match(pathname) : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'relative flex items-center gap-3 h-10 px-3 rounded-md text-sm transition',
                    active
                      ? 'bg-brand-50 text-ink-900 font-semibold'
                      : 'text-ink-700 hover:bg-canvas hover:text-ink-900',
                  ].join(' ')}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-600 rounded-r-md" />
                  )}
                  <span className={active ? 'text-brand-700' : 'text-ink-500'}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {open && (
          <div onClick={() => setOpen(false)} className="md:hidden fixed inset-0 top-14 z-30 bg-black/30" />
        )}

        {/* CONTENT */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-8">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-3xl text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, hint, accent = 'ink' }: { label: string; value: string | number; hint?: string; accent?: 'ink' | 'brand' | 'success' | 'warn'; }) {
  const tone =
    accent === 'brand' ? 'text-brand-700' :
    accent === 'success' ? 'text-success' :
    accent === 'warn' ? 'text-warn' :
    'text-ink-900';
  return (
    <div className="rounded-md bg-surface border border-line p-5 shadow-card">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-500">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-ink-500 mt-1.5">{hint}</p>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: 'success' | 'warn' | 'danger' | 'neutral' | 'info'; children: ReactNode }) {
  const map: Record<string, string> = {
    success: 'bg-emerald-50 text-success border border-emerald-100',
    warn: 'bg-amber-50 text-warn border border-amber-100',
    danger: 'bg-red-50 text-danger border border-red-100',
    neutral: 'bg-canvas text-ink-700 border border-line',
    info: 'bg-brand-50 text-brand-700 border border-brand-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md bg-surface border border-line shadow-card ${className}`}>{children}</div>;
}

/* shared lucide-style icons */
export const Icons = {
  Home: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H10v7H6a2 2 0 0 1-2-2V10z"/></svg>),
  Tag: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>),
  Box: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v9"/></svg>),
  Star: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5l2.95 6.4 6.55.6-4.95 4.55 1.4 6.45L12 17.6l-5.95 2.9 1.4-6.45L2.5 9.5l6.55-.6L12 2.5z"/></svg>),
  Wallet: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V7z"/><path d="M3 7V5a2 2 0 0 1 2-2h12"/><circle cx="17" cy="14" r="1.4"/></svg>),
  Settings: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>),
  Users: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  Chart: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>),
  Layers: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>),
  Bell: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/></svg>),
  Eye: (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>),
};
