'use client';
import { useState } from 'react';
import { emptySlide, type ImageSliderSettings, type ImageSliderSlide } from './ImageSlider';
import type { EditorContext } from '../types';
import { ImageField } from '@/components/blocks/system/formPrimitives';
import { uploadBlockFile } from '../uploadHelper';

export function ImageSliderEditor({ settings: s, onChange, ctx }: {
  settings: ImageSliderSettings;
  onChange: (next: ImageSliderSettings) => void;
  ctx: EditorContext;
}) {
  const slides = s.slides ?? [];
  const [uploading, setUploading] = useState<number | null>(null);

  function updateSlide(i: number, patch: Partial<ImageSliderSlide>) {
    onChange({ ...s, slides: slides.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function addSlide() {
    onChange({ ...s, slides: [...slides, emptySlide()] });
  }

  async function uploadVideo(i: number, file: File) {
    setUploading(i);
    try {
      const url = await uploadBlockFile(ctx, file);
      updateSlide(i, { videoUrl: url });
    } finally {
      setUploading(null);
    }
  }
  function removeSlide(i: number) {
    onChange({ ...s, slides: slides.filter((_, idx) => idx !== i) });
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...s, slides: next });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Height</span>
          <select className="input-field" value={s.height}
            onChange={(e) => onChange({ ...s, height: e.target.value as any })}>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Auto-rotate</span>
          <select className="input-field" value={s.autoplay ? 'on' : 'off'}
            onChange={(e) => onChange({ ...s, autoplay: e.target.value === 'on' })}>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1">Interval (sec)</span>
          <input type="number" min={2} max={15} className="input-field" value={s.interval}
            onChange={(e) => onChange({ ...s, interval: Number(e.target.value) || 5 })} />
        </label>
      </div>

      <div className="space-y-2">
        {slides.map((slide, i) => (
          <div key={i} className="rounded-md border border-line p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-ink-500">Slide #{i + 1}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="text-xs text-ink-500 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === slides.length - 1}
                  className="text-xs text-ink-500 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeSlide(i)} className="text-xs text-danger">Remove</button>
              </div>
            </div>
            <label className="block">
              <span className="block text-xs font-medium text-ink-700 mb-1">Slide type</span>
              <select className="input-field h-9 text-sm" value={slide.kind || 'image'}
                onChange={(e) => updateSlide(i, { kind: e.target.value as 'image' | 'video' })}>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>

            {slide.kind === 'video' ? (
              <div className="space-y-2">
                <input className="input-field h-9 text-sm" placeholder="Video URL (.mp4 / .webm)"
                  value={slide.videoUrl} onChange={(e) => updateSlide(i, { videoUrl: e.target.value })} />
                <label className="flex items-center gap-2 text-xs text-ink-600">
                  <span className="rounded-md border border-ink-200 px-2.5 py-1.5 cursor-pointer hover:border-brand-600 hover:text-brand-700">
                    {uploading === i ? 'Uploading…' : 'Upload video'}
                  </span>
                  <input type="file" accept="video/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(i, f); }} />
                  {slide.videoUrl && <span className="truncate text-ink-500">{slide.videoUrl}</span>}
                </label>
                <ImageField label="Poster image (optional)" value={slide.imageUrl} onChange={(url) => updateSlide(i, { imageUrl: url })} hint="Shown before the video plays." />
              </div>
            ) : (
              <ImageField label="Image" value={slide.imageUrl} onChange={(url) => updateSlide(i, { imageUrl: url })} optional={false} />
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field h-9 text-sm" placeholder="Heading (optional)"
                value={slide.heading} onChange={(e) => updateSlide(i, { heading: e.target.value })} />
              <input className="input-field h-9 text-sm" placeholder="Subheading (optional)"
                value={slide.subheading} onChange={(e) => updateSlide(i, { subheading: e.target.value })} />
              <input className="input-field h-9 text-sm" placeholder="Button label (optional)"
                value={slide.ctaLabel} onChange={(e) => updateSlide(i, { ctaLabel: e.target.value })} />
              <input className="input-field h-9 text-sm" placeholder="Button link (e.g. /products)"
                value={slide.ctaHref} onChange={(e) => updateSlide(i, { ctaHref: e.target.value })} />
            </div>
            <input className="input-field h-9 text-sm" placeholder="Alt text (optional)"
              value={slide.alt} onChange={(e) => updateSlide(i, { alt: e.target.value })} />
          </div>
        ))}
        {slides.length < 8 && (
          <button type="button" onClick={addSlide}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800">+ Add slide</button>
        )}
      </div>
    </div>
  );
}
