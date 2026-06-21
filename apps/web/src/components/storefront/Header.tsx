'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLang } from '@/lib/i18n';

// Vendor-focused marketing header. This site is for sellers — shoppers visit each
// vendor's own storefront (their subdomain or custom domain), not a central catalogue.
export function Header() {
  const pathname = usePathname() || '';
  const { t } = useLang();
  // Hide on vendor / admin dashboard routes — they use their own shell.
  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-line">
      <div className="max-w-container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-1 shrink-0" aria-label="Vrindaonline home">
          <Logo />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5 text-sm shrink-0">
          <Link href="/how-it-works" className="hidden sm:inline font-medium text-ink-700 hover:text-brand-700">
            {t('How it works', 'कैसे काम करता है')}
          </Link>
          <Link href="/sell/login" className="hidden sm:inline font-medium text-ink-700 hover:text-brand-700 whitespace-nowrap">
            {t('Log in', 'लॉग इन')}
          </Link>
          <Link
            href="/sell/register"
            className="hidden sm:inline-flex items-center rounded-pill bg-brand-600 text-white font-semibold text-xs sm:text-sm px-3.5 sm:px-4 py-2 hover:bg-brand-700 transition whitespace-nowrap"
          >
            {t('Start selling', 'बेचना शुरू करें')}
          </Link>
          <LanguageToggle />
        </nav>
      </div>
    </header>
  );
}
