'use client';
import Link from 'next/link';

export interface ImageWithTextSettings {
  mediaKind: 'image' | 'video';
  imageUrl: string;   // image, or poster for a video
  videoUrl: string;   // mp4/webm when mediaKind = 'video'
  imagePosition: 'left' | 'right';
  width: 'contained' | 'full';   // 'full' = edge-to-edge, media covers its column
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

export function ImageWithTextRenderer({ settings: s }: { settings: ImageWithTextSettings }) {
  const reverse = s.imagePosition === 'right';
  const isVideo = s.mediaKind === 'video' && !!s.videoUrl;
  const full = s.width === 'full';

  // ── Full width: the media spans the ENTIRE row edge-to-edge (no grid), with the
  // text overlaid on top like a banner. This is what "full width" means for media.
  if (full) {
    const hasText = !!(s.heading || s.body || (s.ctaLabel && s.ctaHref));
    const mediaCls = 'w-full h-[58vh] min-h-[360px] max-h-[680px] object-cover';
    return (
      <section className="relative w-full overflow-hidden">
        {isVideo ? (
          <video src={s.videoUrl} poster={s.imageUrl || undefined} className={mediaCls} autoPlay muted loop playsInline />
        ) : s.imageUrl ? (
          <img src={s.imageUrl} alt={s.heading} className={mediaCls} />
        ) : (
          <div className={`${mediaCls} bg-canvas flex items-center justify-center text-ink-400 text-sm`}>No media</div>
        )}
        {hasText && (
          <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-center px-6">
            {s.heading && <h2 className="font-display text-3xl sm:text-5xl text-white drop-shadow-md mb-3">{s.heading}</h2>}
            {s.body && <p className="text-white/90 text-sm sm:text-lg max-w-2xl whitespace-pre-line mb-5 drop-shadow">{s.body}</p>}
            {s.ctaLabel && s.ctaHref && (
              <Link href={s.ctaHref} className="inline-block bg-white text-ink-900 hover:bg-white/90 px-6 py-2.5 rounded-md font-medium transition-colors">
                {s.ctaLabel}
              </Link>
            )}
          </div>
        )}
      </section>
    );
  }

  // ── Contained: classic two-column media + text.
  const media = isVideo ? (
    <video src={s.videoUrl} poster={s.imageUrl || undefined} className="w-full h-auto object-cover rounded-lg" autoPlay muted loop playsInline />
  ) : s.imageUrl ? (
    <img src={s.imageUrl} alt={s.heading} className="w-full h-auto object-cover rounded-lg" />
  ) : (
    <div className="w-full aspect-[4/3] rounded-lg bg-canvas border border-line flex items-center justify-center text-ink-400 text-sm">
      No media
    </div>
  );

  return (
    <section className="px-6 sm:px-10 py-12">
      <div className={`grid sm:grid-cols-2 gap-8 items-center ${reverse ? 'sm:[direction:rtl]' : ''}`}>
        <div className={reverse ? 'sm:[direction:ltr]' : ''}>{media}</div>
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
    mediaKind: 'image',
    imageUrl: '',
    videoUrl: '',
    imagePosition: 'left',
    width: 'contained',
    heading: 'Crafted with care',
    body: 'Every piece is made by hand in our small studio.',
    ctaLabel: '',
    ctaHref: '',
  };
}
