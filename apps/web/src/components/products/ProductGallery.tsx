'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  name: string;
  images: string[];
  imageAlts?: string[];
  videoUrl?: string | null;
}

interface Slide {
  type: 'video' | 'image';
  url: string;
  thumb: string; // for thumbnails — video uses its poster fallback (first image)
  alt: string;
}

export function ProductGallery({ name, images, imageAlts = [], videoUrl }: Props) {
  const slides: Slide[] = [];
  if (videoUrl) slides.push({ type: 'video', url: videoUrl, thumb: images[0] ?? '', alt: `${name} — product video` });
  for (let i = 0; i < images.length; i++) {
    slides.push({ type: 'image', url: images[i], thumb: images[i], alt: imageAlts[i] || name });
  }

  const [active, setActive] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const mainRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  // Reset on slide change
  useEffect(() => { setZoomActive(false); }, [active]);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (slides[active]?.type !== 'image') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0 && active < slides.length - 1) setActive(active + 1);
    else if (dx > 0 && active > 0) setActive(active - 1);
  }

  if (slides.length === 0) {
    return (
      <div className="aspect-square bg-stone-100 rounded-md flex items-center justify-center text-ink-500 text-sm">
        No media
      </div>
    );
  }

  const current = slides[active];

  return (
    <div className="flex gap-4">
      {/* Desktop thumbnails */}
      <div className="hidden md:flex flex-col gap-2 w-20 shrink-0">
        {slides.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={s.type === 'video' ? 'Play video' : `View image ${i + 1}`}
            className={`relative aspect-square rounded-md overflow-hidden border-2 transition ${
              i === active ? 'border-ink-900' : 'border-transparent hover:border-line'
            }`}
          >
            {s.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-stone-200" />
            )}
            {s.type === 'video' && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        {/* Main media */}
        <div
          ref={mainRef}
          className="relative aspect-square bg-stone-100 rounded-md overflow-hidden select-none"
          onMouseEnter={() => current.type === 'image' && setZoomActive(true)}
          onMouseLeave={() => setZoomActive(false)}
          onMouseMove={onMouseMove}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {current.type === 'video' ? (
            <video
              key={current.url}
              src={current.url}
              poster={current.thumb || undefined}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt}
              className="w-full h-full object-cover transition-transform duration-150"
              style={
                zoomActive
                  ? { transform: 'scale(2)', transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                  : undefined
              }
              draggable={false}
            />
          )}

          {/* Slide nav arrows (desktop only, only when more than one slide) */}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActive((a) => Math.max(0, a - 1))}
                disabled={active === 0}
                aria-label="Previous"
                className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-surface/90 border border-line shadow-card disabled:opacity-40 hover:bg-surface"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button
                type="button"
                onClick={() => setActive((a) => Math.min(slides.length - 1, a + 1))}
                disabled={active === slides.length - 1}
                aria-label="Next"
                className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-surface/90 border border-line shadow-card disabled:opacity-40 hover:bg-surface"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </>
          )}

          {slides.length > 1 && (
            <div className="md:hidden absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/40">
              {slides.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === active ? 'bg-white' : 'bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Mobile horizontal thumbnails */}
        <div className="md:hidden mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative w-16 h-16 shrink-0 rounded-md overflow-hidden border-2 ${
                i === active ? 'border-ink-900' : 'border-transparent'
              }`}
            >
              {s.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.thumb} alt="" className="w-full h-full object-cover" />
              )}
              {s.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
