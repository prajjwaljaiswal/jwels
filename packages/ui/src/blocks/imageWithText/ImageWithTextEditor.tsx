'use client';
import { useState } from 'react';
import { ImageField } from '@/components/blocks/system/formPrimitives';
import type { ImageWithTextSettings } from './ImageWithText';
import type { EditorContext } from '../types';
import { uploadBlockFile } from '../uploadHelper';

export function ImageWithTextEditor({
  settings: s,
  onChange,
  ctx,
}: {
  settings: ImageWithTextSettings;
  onChange: (next: ImageWithTextSettings) => void;
  ctx: EditorContext;
}) {
  const [uploading, setUploading] = useState(false);
  const kind = s.mediaKind || 'image';

  async function uploadVideo(file: File) {
    setUploading(true);
    try {
      const url = await uploadBlockFile(ctx, file);
      onChange({ ...s, videoUrl: url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Media type">
        <select className="input-field" value={kind}
          onChange={(e) => onChange({ ...s, mediaKind: e.target.value as 'image' | 'video' })}>
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </Field>

      {kind === 'video' ? (
        <div className="space-y-2">
          <Field label="Video URL (.mp4 / .webm)">
            <input className="input-field" value={s.videoUrl || ''}
              onChange={(e) => onChange({ ...s, videoUrl: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-ink-600">
            <span className="rounded-md border border-ink-200 px-2.5 py-1.5 cursor-pointer hover:border-brand-600 hover:text-brand-700">
              {uploading ? 'Uploading…' : 'Upload video'}
            </span>
            <input type="file" accept="video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); }} />
            {s.videoUrl && <span className="truncate text-ink-500">{s.videoUrl}</span>}
          </label>
          <ImageField label="Poster image (optional)" value={s.imageUrl} onChange={(url) => onChange({ ...s, imageUrl: url })} hint="Shown before the video plays." />
        </div>
      ) : (
        <ImageField label="Image" value={s.imageUrl} onChange={(url) => onChange({ ...s, imageUrl: url })} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Media position">
          <select
            className="input-field"
            value={s.imagePosition}
            onChange={(e) => onChange({ ...s, imagePosition: e.target.value as ImageWithTextSettings['imagePosition'] })}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Field>
        <Field label="Width">
          <select
            className="input-field"
            value={s.width || 'contained'}
            onChange={(e) => onChange({ ...s, width: e.target.value as ImageWithTextSettings['width'] })}
          >
            <option value="contained">Contained</option>
            <option value="full">Full width</option>
          </select>
        </Field>
      </div>
      <Field label="Heading">
        <input className="input-field" value={s.heading} maxLength={200} onChange={(e) => onChange({ ...s, heading: e.target.value })} />
      </Field>
      <Field label="Body">
        <textarea className="input-field" rows={4} value={s.body} maxLength={2000} onChange={(e) => onChange({ ...s, body: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Button label (optional)">
          <input className="input-field" value={s.ctaLabel} maxLength={40} onChange={(e) => onChange({ ...s, ctaLabel: e.target.value })} />
        </Field>
        <Field label="Button link">
          <input className="input-field" value={s.ctaHref} onChange={(e) => onChange({ ...s, ctaHref: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
