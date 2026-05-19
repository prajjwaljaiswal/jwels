'use client';
import Link from 'next/link';

export interface HeroSettings {
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
  backgroundImageUrl: string;
  alignment: 'left' | 'center';
  height: 'sm' | 'md' | 'lg';
}

const heightClass: Record<HeroSettings['height'], string> = {
  sm: 'min-h-[260px]',
  md: 'min-h-[420px]',
  lg: 'min-h-[600px]',
};

export function HeroRenderer({ settings: s }: { settings: HeroSettings }) {
  const align = s.alignment === 'center' ? 'items-center text-center' : 'items-start text-left';
  return (
    <section
      className={`relative w-full overflow-hidden flex flex-col justify-center px-6 sm:px-10 py-12 ${heightClass[s.height]} ${align}`}
      style={
        s.backgroundImageUrl
          ? { backgroundImage: `url(${s.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: 'var(--vendor-primary, #0f172a)' }
      }
    >
      {s.backgroundImageUrl && <div className="absolute inset-0 bg-black/35" />}
      <div className={`relative max-w-3xl text-white ${s.alignment === 'center' ? 'mx-auto' : ''}`}>
        {s.headline && <h1 className="text-3xl sm:text-5xl font-semibold leading-tight">{s.headline}</h1>}
        {s.subheadline && <p className="mt-3 text-base sm:text-lg text-white/90">{s.subheadline}</p>}
        {s.ctaLabel && s.ctaHref && (
          <Link
            href={s.ctaHref}
            className="mt-6 inline-block bg-white text-ink-900 hover:bg-white/90 px-6 py-3 rounded-md font-medium"
          >
            {s.ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

export function defaultHero(): HeroSettings {
  return {
    headline: 'Welcome to our shop',
    subheadline: 'Handcrafted jewelry, made with love.',
    ctaLabel: 'Shop now',
    ctaHref: '#products',
    backgroundImageUrl: '',
    alignment: 'center',
    height: 'md',
  };
}
