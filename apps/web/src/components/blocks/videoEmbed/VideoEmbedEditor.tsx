'use client';
import type { VideoEmbedSettings } from './VideoEmbed';

export function VideoEmbedEditor({
  settings: s,
  onChange,
}: {
  settings: VideoEmbedSettings;
  onChange: (next: VideoEmbedSettings) => void;
  ctx: any;
}) {
  return (
    <div className="space-y-3">
      <Field label="Provider">
        <select
          className="input-field"
          value={s.provider}
          onChange={(e) => onChange({ ...s, provider: e.target.value as VideoEmbedSettings['provider'] })}
        >
          <option value="youtube">YouTube</option>
          <option value="vimeo">Vimeo</option>
          <option value="mp4">MP4 URL</option>
        </select>
      </Field>
      <Field label={s.provider === 'mp4' ? 'MP4 URL' : 'Video URL or ID'}>
        <input
          className="input-field"
          value={s.urlOrId}
          maxLength={500}
          placeholder={
            s.provider === 'youtube'
              ? 'https://youtu.be/dQw4w9WgXcQ'
              : s.provider === 'vimeo'
              ? 'https://vimeo.com/123456789'
              : 'https://example.com/video.mp4'
          }
          onChange={(e) => onChange({ ...s, urlOrId: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Aspect ratio">
          <select
            className="input-field"
            value={s.aspectRatio}
            onChange={(e) => onChange({ ...s, aspectRatio: e.target.value as VideoEmbedSettings['aspectRatio'] })}
          >
            <option value="16:9">16:9 (widescreen)</option>
            <option value="4:5">4:5 (portrait)</option>
            <option value="1:1">1:1 (square)</option>
          </select>
        </Field>
        <Field label="Caption">
          <input className="input-field" value={s.caption} maxLength={200} onChange={(e) => onChange({ ...s, caption: e.target.value })} />
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
