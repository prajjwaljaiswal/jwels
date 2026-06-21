'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function StickyCta() {
  const [visible, setVisible] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const goingDown = y > lastY.current;
      lastY.current = y;
      // Show after scrolling past ~70% of first viewport, hide near bottom
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const past = y > window.innerHeight * 0.7;
      const nearBottom = max > 0 && y / max > 0.95;
      setVisible(past && !nearBottom && (goingDown || y > window.innerHeight));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${
        visible ? 'bottom-6 opacity-100' : '-bottom-20 opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="glass-dark text-white rounded-pill border border-white/10 shadow-pop pl-2 pr-2 py-2 flex items-center gap-2">
        <span className="hidden sm:inline-flex pl-3 pr-2 text-sm font-medium">
          Open your shop <span className="text-[#FFC58A] font-semibold ml-1">free · pay only when you sell</span>
        </span>
        <Link
          href="/sell/register"
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 transition rounded-pill px-5 py-2.5 text-sm font-semibold"
        >
          Get started
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
