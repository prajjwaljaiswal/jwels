'use client';
import Link from 'next/link';
import { useRef, type ReactNode } from 'react';

export function MagneticButton({
  href,
  children,
  variant = 'primary',
  className = '',
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost-light';
  className?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const innerRef = useRef<HTMLSpanElement | null>(null);

  function handleMove(e: React.MouseEvent<HTMLSpanElement>) {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const strength = 0.25;
    inner.style.transform = `translate(${cx * strength}px, ${cy * strength}px)`;
  }
  function handleLeave() {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transform = 'translate(0, 0)';
  }

  const base =
    'relative inline-flex items-center justify-center font-semibold rounded-pill px-7 py-3.5 transition-all duration-300';
  const styles: Record<string, string> = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_22px_rgba(241,100,30,0.35)] hover:shadow-[0_12px_30px_rgba(241,100,30,0.45)]',
    secondary:
      'bg-white text-ink-900 border border-ink-900 hover:bg-ink-900 hover:text-white',
    'ghost-light':
      'bg-white/10 text-white border border-white/30 backdrop-blur-md hover:bg-white/20',
  };

  return (
    <span
      ref={wrapRef}
      className="inline-block"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <Link href={href} aria-label={ariaLabel} className={`${base} ${styles[variant]} ${className}`}>
        <span ref={innerRef} className="inline-flex items-center gap-2 transition-transform duration-200 ease-out">
          {children}
        </span>
      </Link>
    </span>
  );
}
