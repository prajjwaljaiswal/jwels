'use client';

// Centralised media picker drawer. Three modes:
//   - "Library" tab: grid of vendor's existing assets, click to select
//   - "Upload"  tab: drag/drop or pick from disk → Cloudinary → new VendorAsset
//   - "URL"     tab: paste an external URL directly (no upload)
//
// Returns the selected URL via onPick. Used by ImageField everywhere a block
// setting expects an image URL.

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export interface MediaAsset {
  id: string;
  url: string;
  kind: 'image' | 'video';
  alt: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (url: string, asset?: MediaAsset) => void;
  // Restrict to images by default — videos rarely needed in block fields.
  accept?: 'image' | 'video' | 'both';
}

export function MediaPicker({ open, onClose, onPick, accept = 'image' }: Props) {
  type Tab = 'library' | 'upload' | 'url';
  const [tab, setTab] = useState<Tab>('library');
  const [assets, setAssets] = useState<MediaAsset[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(reset = true) {
    try {
      const qs = new URLSearchParams({ limit: '40' });
      if (search) qs.set('q', search);
      if (!reset && cursor) qs.set('cursor', cursor);
      const data = await api<{ assets: MediaAsset[]; nextCursor: string | null }>(
        `/api/vendors/me/assets?${qs.toString()}`,
        { silent: true }
      );
      setAssets((prev) => (reset || !prev ? data.assets : [...prev, ...data.assets]));
      setCursor(data.nextCursor);
    } catch {
      setAssets([]);
    }
  }

  // Reset / reload when opened.
  useEffect(() => {
    if (!open) return;
    setTab('library');
    setUrlInput('');
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      const arr = Array.from(files).slice(0, 10);
      for (const f of arr) {
        const fd = new FormData();
        fd.append('file', f);
        try {
          const row = await api<MediaAsset>('/api/vendors/me/assets', {
            method: 'POST', body: fd, silent: true,
          });
          // Optimistically prepend.
          setAssets((prev) => [row, ...(prev ?? [])]);
        } catch (e: any) {
          toast.error(`Upload failed: ${f.name}${e?.message ? ` — ${e.message}` : ''}`);
        }
      }
      if (arr.length > 1) toast.success(`${arr.length} files uploaded`);
      setTab('library');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  async function removeAsset(id: string) {
    if (!confirm('Delete this asset? Blocks referencing the URL will break.')) return;
    try {
      await api(`/api/vendors/me/assets/${id}`, { method: 'DELETE', silent: true });
      setAssets((prev) => (prev ?? []).filter((a) => a.id !== id));
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  }

  if (!open) return null;

  const acceptAttr = accept === 'video' ? 'video/*' : accept === 'both' ? 'image/*,video/*' : 'image/*';

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Media library"
      onClick={onClose}
    >
      <div className="flex-1 bg-black/50" />
      <div
        className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <h2 className="font-semibold">Media library</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-900 text-xl leading-none"
            aria-label="Close"
          >×</button>
        </div>
        <div className="px-5 pt-3 flex items-center gap-1 border-b border-line">
          {(['library', 'upload', 'url'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition ${
                tab === t ? 'border-brand-600 text-ink-900 font-medium' : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              {t === 'library' ? 'Library' : t === 'upload' ? 'Upload' : 'Paste URL'}
            </button>
          ))}
        </div>

        {tab === 'library' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <input
              type="text"
              className="input-field w-full mb-3"
              placeholder="Search by alt text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {assets === null ? (
              <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>
            ) : assets.length === 0 ? (
              <div className="text-sm text-ink-500 py-12 text-center">
                <p className="font-medium text-ink-700">No assets yet</p>
                <p className="mt-1">Upload your first image from the "Upload" tab.</p>
              </div>
            ) : (
              <>
                <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {assets.map((a) => (
                    <li key={a.id} className="group relative border border-line rounded-md overflow-hidden bg-canvas">
                      <button
                        type="button"
                        onClick={() => { onPick(a.url, a); onClose(); }}
                        className="block w-full aspect-square"
                        title={a.alt || a.url}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.url} alt={a.alt ?? ''} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAsset(a.id)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/95 border border-line text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                        title="Delete asset"
                        aria-label="Delete asset"
                      >×</button>
                      {(a.width && a.height) ? (
                        <div className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition">
                          {a.width}×{a.height}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {cursor && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={async () => {
                        setLoadingMore(true);
                        await load(false);
                        setLoadingMore(false);
                      }}
                      className="text-sm text-ink-700 hover:text-brand-700 underline"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="block border-2 border-dashed border-ink-300 rounded-md p-10 text-center cursor-pointer hover:border-brand-500 hover:bg-canvas transition"
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={acceptAttr}
                className="hidden"
                onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
              />
              <p className="text-sm font-medium text-ink-900">
                {uploading ? 'Uploading…' : 'Click or drag files here'}
              </p>
              <p className="text-xs text-ink-500 mt-1">
                {accept === 'video' ? 'MP4, MOV' : accept === 'both' ? 'Images & videos' : 'JPG, PNG, WebP, GIF, SVG'}
                {' '}· Up to 10 MB each · Up to 10 files at once
              </p>
            </label>
          </div>
        )}

        {tab === 'url' && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <p className="text-sm text-ink-600">
              Paste a URL to an image you've already hosted elsewhere. Best for product imagery you've optimised externally.
            </p>
            <input
              type="text"
              className="input-field w-full"
              placeholder="https://…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            {urlInput && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urlInput} alt="" className="max-h-64 rounded-md border border-line" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <button
              type="button"
              disabled={!urlInput.trim()}
              onClick={() => { onPick(urlInput.trim()); onClose(); }}
              className="btn-primary text-sm"
            >
              Use this URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
