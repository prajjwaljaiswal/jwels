'use client';
import { type ReactNode } from 'react';

export function Marquee({
  children,
  speed = 'normal',
  className = '',
  pauseOnHover = true,
}: {
  children: ReactNode;
  speed?: 'normal' | 'slow';
  className?: string;
  pauseOnHover?: boolean;
}) {
  const animClass = speed === 'slow' ? 'animate-marquee-slow' : 'animate-marquee';
  return (
    <div
      className={`group relative w-full overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div
        className={`flex w-max ${animClass} ${pauseOnHover ? 'group-hover:[animation-play-state:paused]' : ''}`}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}
