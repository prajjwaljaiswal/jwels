'use client';
import { useRef } from 'react';
import { StepHeader, StepProps, Field } from '../StepShell';

const MAX_PHOTOS = 8;

export function MediaStep({ draft, setDraft }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setDraft((d) => {
      const slotsLeft = Math.max(0, MAX_PHOTOS - d.existingImages.length - d.files.length);
      const incoming = Array.from(list).slice(0, slotsLeft);
      return { ...d, files: [...d.files, ...incoming] };
    });
  }
  function removeAt(idx: number) {
    setDraft((d) => ({ ...d, files: d.files.filter((_, i) => i !== idx) }));
  }
  function move(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...d.files];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return d;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...d, files: next };
    });
  }

  function removeExistingAt(idx: number) {
    setDraft((d) => ({ ...d, existingImages: d.existingImages.filter((_, i) => i !== idx) }));
  }
  function moveExisting(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...d.existingImages];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return d;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...d, existingImages: next };
    });
  }

  const totalCount = draft.files.length + draft.existingImages.length;
  const remaining = MAX_PHOTOS - totalCount;

  return (
    <>
      <StepHeader
        title="Photo & video"
        subtitle="Show off different angles, available options, or even a peek behind the scenes at your process."
      />
      <div className="p-6 space-y-5">
        <div>
          <p className="text-sm font-semibold text-ink-900">
            Add up to {MAX_PHOTOS} photos. <span className="text-danger">*</span>
          </p>
          <p className="text-xs text-ink-500 mt-1">First photo becomes the cover. PNG / JPG, 5 MB each.</p>
        </div>

        {(draft.existingImages.length > 0 || draft.files.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {draft.existingImages.map((url, i) => (
              <div key={`x-${i}`} className="relative group rounded-lg overflow-hidden border border-line bg-canvas">
                <div className="aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
                {i === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-pill bg-brand-600 text-white text-[10px] font-bold">
                    Cover
                  </span>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" onClick={() => moveExisting(i, -1)} disabled={i === 0}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-ink-700 disabled:opacity-30 hover:bg-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button type="button" onClick={() => moveExisting(i, 1)} disabled={i === draft.existingImages.length - 1}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-ink-700 disabled:opacity-30 hover:bg-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                  <button type="button" onClick={() => removeExistingAt(i)}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-danger hover:bg-red-50">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
            {draft.files.map((f, i) => (
              <div key={i} className="relative group rounded-lg overflow-hidden border border-line bg-canvas">
                <div className="aspect-square">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                </div>
                {i === 0 && draft.existingImages.length === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-pill bg-brand-600 text-white text-[10px] font-bold">
                    Cover
                  </span>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-ink-700 disabled:opacity-30 hover:bg-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === draft.files.length - 1}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-ink-700 disabled:opacity-30 hover:bg-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                  <button type="button" onClick={() => removeAt(i)}
                    className="h-7 w-7 rounded-full bg-white/95 shadow flex items-center justify-center text-danger hover:bg-red-50">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {remaining > 0 && (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-line rounded-lg py-12 flex flex-col items-center gap-2 text-ink-500 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50/30 transition-colors">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
            </svg>
            <span className="text-sm font-semibold">Drag and drop or click to upload</span>
            <span className="text-xs">{remaining} slot{remaining !== 1 ? 's' : ''} remaining</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

        {totalCount > 0 && (
          <Field label="Image alt text" hint="Short description of each image — helps SEO and accessibility. One line per image, in display order.">
            <textarea className="input-field min-h-[100px] resize-y font-mono text-xs"
              placeholder={"Front view of pendant in yellow gold\nClose-up of bezel setting\n…"}
              value={Array.from({ length: totalCount }, (_, i) => draft.imageAlts[i] ?? '').join('\n')}
              onChange={(e) => {
                const lines = e.target.value.split('\n').slice(0, totalCount).map((s) => s.slice(0, 160));
                setDraft({ imageAlts: lines });
              }} />
          </Field>
        )}

        <Field label="Hero video URL" hint="Optional — paste a YouTube, Vimeo, or direct MP4 link">
          <input className="input-field" type="url" placeholder="https://youtu.be/…"
            value={draft.videoUrl} maxLength={500}
            onChange={(e) => setDraft({ videoUrl: e.target.value })} />
        </Field>
      </div>
    </>
  );
}
