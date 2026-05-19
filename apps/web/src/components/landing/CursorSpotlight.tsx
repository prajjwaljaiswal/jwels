'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Wrap a section in <CursorSpotlight>...</CursorSpotlight> to give it a soft
 * radial-gradient glow that follows the cursor. Disabled on touch devices and
 * for users who prefer reduced motion.
 */
export function CursorSpotlight({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !fineHover) return;

    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${pendingX}px`);
        el.style.setProperty('--my', `${pendingY}px`);
        raf = 0;
      });
    };
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="spotlight pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
