'use client';
import { createElement, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

type Direction = 'up' | 'left' | 'right' | 'zoom';

export function Reveal({
  children,
  as = 'div',
  direction = 'up',
  delay = 0,
  className = '',
  style,
  once = true,
}: {
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'span' | 'li' | 'header' | 'footer' | 'main' | 'aside';
  direction?: Direction;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            if (once) io.unobserve(el);
          } else if (!once) {
            el.classList.remove('is-visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  const directionAttr = direction === 'up' ? 'true' : direction;
  const mergedStyle: CSSProperties = {
    transitionDelay: `${delay}ms`,
    ...style,
  };

  return createElement(
    as,
    {
      ref,
      'data-reveal': directionAttr,
      className,
      style: mergedStyle,
    },
    children
  );
}
