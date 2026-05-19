'use client';
import { useRef, type ReactNode } from 'react';

/**
 * 3D tilt-on-mouse-move wrapper. Cheap CSS-only transform updates.
 * Disabled implicitly on touch devices (no mousemove fires).
 */
export function TiltCard({
  children,
  className = '',
  max = 10,
}: {
  children: ReactNode;
  className?: string;
  /** Max tilt angle in degrees */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    const ry = (px - 0.5) * max * 2;
    const rx = -(py - 0.5) * max * 2;
    el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`tilt-surface ${className}`}
    >
      {children}
    </div>
  );
}
