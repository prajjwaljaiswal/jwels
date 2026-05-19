'use client';
import Link from 'next/link';

export interface ImageWithTextSettings {
  imageUrl: string;
  imagePosition: 'left' | 'right';
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export function ImageWithTextRenderer({ settings: s }: { settings: ImageWithTextSettings }) {
  const reverse = s.imagePosition === 'right';
  return (
    <section className="px-6 sm:px-10 py-12">
      <div className={`grid sm:grid-cols-2 gap-8 items-center ${reverse ? 'sm:[direction:rtl]' : ''}`}>
        <div className={reverse ? 'sm:[direction:ltr]' : ''}>
          {s.imageUrl ? (
            <img src={s.imageUrl} alt={s.heading} className="w-full h-auto rounded-lg object-cover" />
          ) : (
            <div className="w-full aspect-[4/3] rounded-lg bg-canvas border border-line flex items-center justify-center text-ink-400 text-sm">
              No image
            </div>
          )}
        </div>
        <div className={reverse ? 'sm:[direction:ltr]' : ''}>
          {s.heading && <h2 className="text-2xl sm:text-3xl font-semibold mb-3">{s.heading}</h2>}
          {s.body && <p className="text-ink-700 whitespace-pre-line">{s.body}</p>}
          {s.ctaLabel && s.ctaHref && (
            <Link
              href={s.ctaHref}
              className="mt-5 inline-block bg-ink-900 text-white hover:bg-ink-800 px-5 py-2.5 rounded-md font-medium"
            >
              {s.ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export function defaultImageWithText(): ImageWithTextSettings {
  return {
    imageUrl: '',
    imagePosition: 'left',
    heading: 'Crafted with care',
    body: 'Every piece is made by hand in our small studio.',
    ctaLabel: '',
    ctaHref: '',
  };
}
