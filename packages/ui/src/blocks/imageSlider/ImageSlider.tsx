'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export interface ImageSliderSlide {
  kind: 'image' | 'video';
  imageUrl: string;   // image slide, or poster for a video slide
  videoUrl: string;   // mp4/webm URL for video slides
  alt: string;
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
}

function hasMedia(s: ImageSliderSlide): boolean {
  return s.kind === 'video' ? !!s.videoUrl : !!s.imageUrl;
}
export interface ImageSliderSettings {
  height: 'sm' | 'md' | 'lg';
  autoplay: boolean;
  interval: number; // seconds between slides
  slides: ImageSliderSlide[];
}

const heightClass: Record<ImageSliderSettings['height'], string> = {
  sm: 'h-[240px] sm:h-[340px]',
  md: 'h-[340px] sm:h-[480px]',
  lg: 'h-[440px] sm:h-[600px]',
};

export function ImageSliderRenderer({ settings: s }: { settings: ImageSliderSettings }) {
  const slides = (s.slides ?? []).filter(hasMedia);
  const count = slides.length;
  const [active, setActive] = useState(0);
  const touchX = useRef<number | null>(null);

  const go = useCallback((i: number) => {
    if (count === 0) return;
    setActive(((i % count) + count) % count);
  }, [count]);

  // Autoplay
  useEffect(() => {
    if (!s.autoplay || count <= 1) return;
    const ms = Math.min(15, Math.max(2, s.interval || 5)) * 1000;
    const t = setInterval(() => setActive((a) => (a + 1) % count), ms);
    return () => clearInterval(t);
  }, [s.autoplay, s.interval, count]);

  // Keep active index valid if the slide list shrinks
  useEffect(() => { if (active >= count) setActive(0); }, [count, active]);

  if (count === 0) return null;

  function onTouchStart(e: React.TouchEvent) { touchX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    go(dx < 0 ? active + 1 : active - 1);
  }

  return (
    <section
      className={`relative w-full overflow-hidden ${heightClass[s.height]}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-roledescription="carousel"
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            i === active ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden={i !== active}
        >
          {slide.kind === 'video' ? (
            <video
              src={slide.videoUrl}
              poster={slide.imageUrl || undefined}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.imageUrl} alt={slide.alt || slide.heading || ''} className="w-full h-full object-cover" />
          )}
          {(slide.heading || slide.subheading || (slide.ctaLabel && slide.ctaHref)) && (
            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-center px-6">
              {slide.heading && (
                <h2 className="font-display text-3xl sm:text-5xl text-white drop-shadow-md mb-2">{slide.heading}</h2>
              )}
              {slide.subheading && (
                <p className="text-white/90 text-sm sm:text-lg max-w-2xl mb-4 drop-shadow">{slide.subheading}</p>
              )}
              {slide.ctaLabel && slide.ctaHref && (
                <Link
                  href={slide.ctaHref}
                  className="inline-block bg-white text-ink-900 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors"
                >
                  {slide.ctaLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(active - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(active + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${i === active ? 'w-6 bg-white' : 'w-2 bg-white/60 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function defaultImageSlider(): ImageSliderSettings {
  return { height: 'md', autoplay: true, interval: 5, slides: [] };
}

export function emptySlide(): ImageSliderSlide {
  return { kind: 'image', imageUrl: '', videoUrl: '', alt: '', heading: '', subheading: '', ctaLabel: '', ctaHref: '' };
}
