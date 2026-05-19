'use client';
import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
};

export function SparkleCanvas({ density = 60 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const spawn = (initial = false): Particle => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const maxLife = 240 + Math.random() * 280;
      return {
        x: Math.random() * w,
        y: initial ? Math.random() * h : h + Math.random() * 40,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.1 - Math.random() * 0.35,
        life: initial ? Math.random() * maxLife : 0,
        maxLife,
        hue: 32 + Math.random() * 14, // warm gold
      };
    };

    const init = () => {
      resize();
      particles = Array.from({ length: density }, () => spawn(true));
    };

    const tick = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        // soft sin drift
        p.x += Math.sin(p.life * 0.02) * 0.08;

        const t = p.life / p.maxLife;
        const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        grd.addColorStop(0, `hsla(${p.hue}, 85%, 65%, ${0.85 * alpha})`);
        grd.addColorStop(0.3, `hsla(${p.hue}, 85%, 60%, ${0.35 * alpha})`);
        grd.addColorStop(1, 'hsla(40, 85%, 55%, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();

        // crisp core
        ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        if (p.y < -20 || p.life > p.maxLife) {
          Object.assign(p, spawn(false));
        }
      }

      raf = requestAnimationFrame(tick);
    };

    init();
    tick();

    const onResize = () => { resize(); };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [density]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
