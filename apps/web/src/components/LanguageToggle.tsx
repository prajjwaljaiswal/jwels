'use client';
import { useLang } from '@/lib/i18n';

// EN / हिं switch. Reads the site-wide language context, so dropping it anywhere
// (header, footer, a page) controls the whole site.
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      className={`inline-flex items-center rounded-pill border border-line bg-surface overflow-hidden shrink-0 ${className}`}
      role="group"
      aria-label="Language / भाषा"
    >
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 text-xs font-semibold transition ${
            lang === l ? 'bg-brand-600 text-white' : 'text-ink-700 hover:text-brand-700'
          }`}
        >
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}
