'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/dashboard/DashboardShell';
import { AVAILABLE_BLOCKS, BLOCK_REGISTRY } from '@/components/blocks';
import { BlockSettingsForm } from '@/components/blocks/BlockSettingsForm';
import { getBlockSummary } from '@/components/blocks/blockSummary';
import type { Block, BlockType, PageKind } from '@/components/blocks/types';

interface PageVersion {
  id: string;
  versionNum: number;
  publishedAt: string;
  publishedBy: string;
}

interface PageData {
  id: string;
  vendorId: string;
  slug: string;
  pageKind: PageKind;
  title: string;
  isHomepage: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  draftBlocks: Block[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoImageUrl: string | null;
  versions: PageVersion[];
}

export default function VendorPageEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [page, setPage] = useState<PageData | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Auto-save status. Drives the live pill in the sticky bar.
  type SaveState = 'idle' | 'saving' | 'saved' | 'error';
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savedNow, setSavedNow] = useState<number>(Date.now());
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preview viewport toggle (matches Webflow / Storyblok / Shopify conventions).
  type Device = 'mobile' | 'tablet' | 'desktop';
  const [device, setDevice] = useState<Device>('desktop');
  const deviceWidth: Record<Device, number | null> = { mobile: 390, tablet: 820, desktop: null };
  const [showAdd, setShowAdd] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiReplace, setAiReplace] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const ctx = useMemo(
    () => (page ? { scope: 'vendor' as const, vendorId: page.vendorId, pageId: page.id, pageKind: page.pageKind } : null),
    [page]
  );
  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const paletteBlocks = useMemo(
    () => AVAILABLE_BLOCKS.filter((b) => !b.allowedKinds || (page && b.allowedKinds.includes(page.pageKind))),
    [page]
  );
  const missingRequired = useMemo(() => {
    if (!page) return [] as string[];
    return AVAILABLE_BLOCKS
      .filter((b) => b.requiredOn?.includes(page.pageKind))
      .filter((req) => !blocks.some((b) => b.type === req.type))
      .map((b) => b.label);
  }, [page, blocks]);

  async function load() {
    const data = await api<PageData>(`/api/vendor-pages/me/${id}`);
    setPage(data);
    setBlocks(Array.isArray(data.draftBlocks) ? data.draftBlocks : []);
    setDirty(false);
  }

  useEffect(() => {
    load().catch(() => router.push('/pages'));
  }, [id]);

  function mutate(next: Block[]) {
    setBlocks(next);
    setDirty(true);
  }

  function addBlock(type: BlockType) {
    const def = BLOCK_REGISTRY[type];
    if (!def) return;
    const block: Block = { id: nanoid(10), type, settings: def.defaultSettings() };
    mutate([...blocks, block]);
    setSelectedId(block.id);
    setShowAdd(false);
  }

  function updateBlock(next: Block) {
    mutate(blocks.map((b) => (b.id === next.id ? next : b)));
  }

  function toggleHidden(blockId: string) {
    mutate(blocks.map((b) => (b.id === blockId ? { ...b, hidden: !b.hidden } : b)));
  }

  function duplicateBlock(blockId: string) {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const src = blocks[idx]!;
    // Deep-clone settings so the copy is independent (items arrays, fields, etc.).
    const clone: Block = {
      ...src,
      id: nanoid(10),
      settings: typeof structuredClone === 'function'
        ? structuredClone(src.settings)
        : JSON.parse(JSON.stringify(src.settings)),
    };
    const next = [...blocks.slice(0, idx + 1), clone, ...blocks.slice(idx + 1)];
    mutate(next);
    setSelectedId(clone.id);
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const copy = blocks.slice();
    [copy[idx], copy[j]] = [copy[j]!, copy[idx]!];
    mutate(copy);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    mutate(arrayMove(blocks, oldIdx, newIdx));
  }

  function removeBlock(blockId: string) {
    if (!page) return;
    const block = blocks.find((b) => b.id === blockId);
    if (block) {
      const def = BLOCK_REGISTRY[block.type];
      const isRequired = !!def?.requiredOn?.includes(page.pageKind);
      const sameTypeCount = blocks.filter((b) => b.type === block.type).length;
      if (isRequired && sameTypeCount <= 1) {
        toast.error(`"${def?.label ?? block.type}" is required on ${page.pageKind} pages and cannot be removed`);
        return;
      }
    }
    mutate(blocks.filter((b) => b.id !== blockId));
    if (selectedId === blockId) setSelectedId(null);
  }

  async function save(silent = false) {
    if (!page) return;
    setSaving(true);
    setSaveState('saving');
    try {
      await api(`/api/vendor-pages/me/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ draftBlocks: blocks }),
        // Suppress the global toast on auto-save failures — the pill is enough.
        silent,
      });
      setDirty(false);
      setSaveState('saved');
      setSavedAt(Date.now());
      if (!silent) toast.success('Draft saved');
      iframeRef.current?.contentWindow?.postMessage({ type: 'jm:refresh' }, '*');
    } catch {
      setSaveState('error');
    } finally {
      setSaving(false);
    }
  }

  // ── Auto-save: debounce a silent PATCH 1.5s after the last edit ──────────
  useEffect(() => {
    if (!dirty || !page) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { void save(true); }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, dirty, page?.id]);

  // Tick a "now" cursor every 15s so the "Saved 2m ago" label stays fresh
  // without re-rendering on every keystroke.
  useEffect(() => {
    const t = setInterval(() => setSavedNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Warn before navigating away with unsaved (or actively-saving) work.
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty || saveState === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, saveState]);

  async function publish() {
    if (!page) return;
    if (dirty) await save(true);
    setPublishing(true);
    try {
      await api(`/api/vendor-pages/me/${page.id}/publish`, { method: 'POST' });
      toast.success('Published');
      load();
    } catch {
    } finally {
      setPublishing(false);
    }
  }

  async function restore(versionNum: number) {
    if (!page) return;
    if (!confirm(`Restore version ${versionNum} to your draft? Your current unpublished changes will be replaced.`)) return;
    try {
      await api(`/api/vendor-pages/me/${page.id}/restore/${versionNum}`, { method: 'POST' });
      toast.success(`Restored version ${versionNum}`);
      setShowVersions(false);
      load();
    } catch {}
  }

  async function aiGenerate() {
    if (!page) return;
    if (aiBrief.trim().length < 5) {
      toast.error('Tell us a bit more about your shop');
      return;
    }
    setAiLoading(true);
    try {
      const result = await api<{ page: PageData; source: 'ai' | 'fallback'; addedBlockCount: number }>(
        `/api/vendor-pages/me/${page.id}/ai-generate`,
        {
          method: 'POST',
          body: JSON.stringify({ brief: aiBrief, replace: aiReplace }),
        }
      );
      toast.success(
        result.source === 'ai'
          ? `Generated ${result.addedBlockCount} block(s)`
          : 'AI not configured — used a curated template'
      );
      setAiOpen(false);
      setAiBrief('');
      load();
    } catch {
    } finally {
      setAiLoading(false);
    }
  }

  async function saveMeta(meta: Partial<Pick<PageData, 'title' | 'slug' | 'seoTitle' | 'seoDescription' | 'seoImageUrl'>>) {
    if (!page) return;
    try {
      const updated = await api<PageData>(`/api/vendor-pages/me/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify(meta),
      });
      setPage((p) => (p ? { ...p, ...updated } : p));
      toast.success('Saved');
    } catch {}
  }

  if (!page || !ctx) {
    return <div className="p-6 text-sm text-ink-600">Loading editor…</div>;
  }

  return (
    <div>
      <PageHeader
        title={page.title}
        subtitle={`/store/${page.vendorId}/${page.slug}${page.isHomepage ? '  ·  homepage' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/pages" className="text-sm text-ink-700 hover:text-brand-700">
              ← All pages
            </Link>
          </div>
        }
      />

      {/* Sticky bar */}
      <div className="sticky top-0 z-20 bg-white border border-line rounded-md mb-4 px-4 py-2 flex items-center gap-2 flex-wrap">
        <SaveStatusPill
          state={saveState}
          dirty={dirty}
          savedAt={savedAt}
          now={savedNow}
          isPublished={page.isPublished}
          publishedAt={page.publishedAt}
          onRetry={() => void save(true)}
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAiOpen(true)}
            className="text-xs text-purple-700 hover:text-purple-900 font-medium"
            title="Generate page blocks with AI"
          >
            ✨ Generate with AI
          </button>
          <button onClick={() => setSeoOpen((v) => !v)} className="text-xs text-ink-700 hover:text-brand-700">
            SEO
          </button>
          {page.versions.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowVersions((v) => !v)} className="text-xs text-ink-700 hover:text-brand-700">
                Versions ({page.versions.length}) ▾
              </button>
              {showVersions && (
                <div className="absolute right-0 mt-1 w-72 bg-white border border-line rounded-md shadow-lg z-30 p-2">
                  {page.versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => restore(v.versionNum)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-canvas flex justify-between"
                    >
                      <span>Version {v.versionNum}</span>
                      <span className="text-ink-500">{new Date(v.publishedAt).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => save()} disabled={!dirty || saving} className="btn-secondary text-xs">
            {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button onClick={publish} disabled={publishing} className="btn-primary text-xs">
            {publishing ? 'Publishing…' : dirty ? 'Save & publish' : 'Publish'}
          </button>
        </div>
      </div>

      {seoOpen && (
        <div className="border border-line rounded-md p-4 mb-4 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Page title">
              <input
                className="input-field"
                defaultValue={page.title}
                onBlur={(e) => e.target.value !== page.title && saveMeta({ title: e.target.value })}
              />
            </Field>
            <Field label="URL slug">
              <input
                className="input-field"
                defaultValue={page.slug}
                onBlur={(e) => e.target.value !== page.slug && saveMeta({ slug: e.target.value })}
                disabled={page.isHomepage}
              />
            </Field>
          </div>
          <Field label="SEO title">
            <input
              className="input-field"
              defaultValue={page.seoTitle ?? ''}
              maxLength={160}
              onBlur={(e) => saveMeta({ seoTitle: e.target.value || null })}
            />
          </Field>
          <Field label="SEO description">
            <textarea
              className="input-field"
              rows={2}
              defaultValue={page.seoDescription ?? ''}
              maxLength={320}
              onBlur={(e) => saveMeta({ seoDescription: e.target.value || null })}
            />
          </Field>
          <Field label="SEO share image URL">
            <input
              className="input-field"
              defaultValue={page.seoImageUrl ?? ''}
              onBlur={(e) => saveMeta({ seoImageUrl: e.target.value || null })}
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 min-h-[700px]">
        {/* Left — block list */}
        <div className="col-span-12 lg:col-span-3 border border-line rounded-md bg-white p-3 overflow-y-auto max-h-[80vh]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Blocks</h3>
            <button onClick={() => setShowAdd((v) => !v)} className="text-xs text-brand-700 hover:underline">
              {showAdd ? 'Cancel' : '+ Add block'}
            </button>
          </div>

          {showAdd && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              {paletteBlocks.map((b) => (
                <button
                  key={b.type}
                  onClick={() => addBlock(b.type)}
                  className="border border-line rounded-md p-2 text-left hover:border-brand-400 text-xs"
                >
                  <div className="text-lg">{b.icon as any}</div>
                  <div className="font-medium">{b.label}</div>
                  <div className="text-ink-500">{b.description}</div>
                </button>
              ))}
            </div>
          )}

          {missingRequired.length > 0 && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Missing required block{missingRequired.length > 1 ? 's' : ''}: {missingRequired.join(', ')}. Add {missingRequired.length > 1 ? 'these' : 'it'} before publishing.
            </div>
          )}

          {blocks.length === 0 && (
            <p className="text-xs text-ink-500 italic">No blocks yet. Add one to get started.</p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {blocks.map((b) => (
                  <SortableBlockRow
                    key={b.id}
                    block={b}
                    selected={selectedId === b.id}
                    onSelect={() => setSelectedId(b.id)}
                    onToggleHidden={() => toggleHidden(b.id)}
                    onDuplicate={() => duplicateBlock(b.id)}
                    onRemove={() => {
                      if (confirm('Remove this block?')) removeBlock(b.id);
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        {/* Center — preview */}
        <div className="col-span-12 lg:col-span-6 border border-line rounded-md bg-canvas overflow-hidden flex flex-col">
          <DevicePreviewToolbar device={device} setDevice={setDevice} />
          <div className="flex-1 overflow-auto bg-canvas px-4 py-4 flex items-start justify-center">
            <iframe
              ref={iframeRef}
              src={`/pages/${page.id}/preview`}
              title="Storefront preview"
              className="bg-white border border-line rounded-md transition-[width] duration-200 ease-out"
              style={{
                width: deviceWidth[device] != null ? `${deviceWidth[device]}px` : '100%',
                height: '78vh',
                // Shadow gives mobile/tablet the device-frame feel.
                boxShadow: deviceWidth[device] != null ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
              }}
            />
          </div>
        </div>

        {/* AI modal */}
        {aiOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
            onClick={() => !aiLoading && setAiOpen(false)}
          >
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-2">✨ Generate with AI</h3>
              <p className="text-sm text-ink-600 mb-4">
                Describe your shop in a sentence or two — your style, what you sell, your customer.
                AI will draft blocks for this page that you can then tweak.
              </p>
              <textarea
                className="input-field"
                rows={5}
                placeholder="e.g. Handmade silver jewelry inspired by the ocean, sold to women in their 20s and 30s who love minimalist coastal aesthetics."
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                maxLength={1000}
                disabled={aiLoading}
              />
              <label className="flex items-center gap-2 mt-3 text-sm">
                <input
                  type="checkbox"
                  checked={aiReplace}
                  onChange={(e) => setAiReplace(e.target.checked)}
                  disabled={aiLoading}
                />
                Replace existing blocks (uncheck to append instead)
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="btn-secondary text-sm"
                  onClick={() => setAiOpen(false)}
                  disabled={aiLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary text-sm"
                  onClick={aiGenerate}
                  disabled={aiLoading || aiBrief.trim().length < 5}
                >
                  {aiLoading ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right — settings */}
        <div className="col-span-12 lg:col-span-3 border border-line rounded-md bg-white p-3 overflow-y-auto max-h-[80vh]">
          <h3 className="text-sm font-semibold mb-2">
            {selected ? `Edit ${BLOCK_REGISTRY[selected.type]?.label ?? selected.type}` : 'Block settings'}
          </h3>
          {selected ? (
            <BlockSettingsForm block={selected} onChange={updateBlock} ctx={ctx} />
          ) : (
            <p className="text-xs text-ink-500 italic">Select a block on the left to edit its settings.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DevicePreviewToolbar({
  device, setDevice,
}: {
  device: 'mobile' | 'tablet' | 'desktop';
  setDevice: (d: 'mobile' | 'tablet' | 'desktop') => void;
}) {
  const items: { key: 'mobile' | 'tablet' | 'desktop'; label: string; width: string; icon: React.ReactNode }[] = [
    {
      key: 'mobile', label: 'Mobile', width: '390 px',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2" width="10" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
        </svg>
      ),
    },
    {
      key: 'tablet', label: 'Tablet', width: '820 px',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18.01"/>
        </svg>
      ),
    },
    {
      key: 'desktop', label: 'Desktop', width: 'Fluid',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
  ];
  return (
    <div className="border-b border-line bg-white px-3 py-1.5 flex items-center justify-between gap-2">
      <span className="text-[11px] uppercase tracking-wide text-ink-500">Preview</span>
      <div className="inline-flex items-center rounded-md border border-line bg-canvas p-0.5">
        {items.map((it) => {
          const active = device === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => setDevice(it.key)}
              title={`${it.label} · ${it.width}`}
              aria-label={`Preview as ${it.label}`}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
                active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              {it.icon}
              <span className="hidden sm:inline">{it.label}</span>
            </button>
          );
        })}
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

function relativeTime(ms: number, now: number): string {
  const delta = Math.max(0, Math.floor((now - ms) / 1000));
  if (delta < 5)    return 'just now';
  if (delta < 60)   return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return new Date(ms).toLocaleString();
}

function SaveStatusPill({
  state, dirty, savedAt, now, isPublished, publishedAt, onRetry,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
  savedAt: number | null;
  now: number;
  isPublished: boolean;
  publishedAt: string | null;
  onRetry: () => void;
}) {
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        Saving…
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-red-700">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
        Auto-save failed
        <button type="button" onClick={onRetry} className="underline hover:no-underline">Retry</button>
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-300" />
        Unsaved changes
      </span>
    );
  }
  if (state === 'saved' && savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        Draft saved · <span className="text-ink-500">{relativeTime(savedAt, now)}</span>
      </span>
    );
  }
  // idle / no edits yet — show publish state.
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
      <span className={`inline-block w-2 h-2 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-ink-300'}`} />
      {isPublished
        ? `Published${publishedAt ? ' · ' + new Date(publishedAt).toLocaleString() : ''}`
        : 'Draft only'}
    </span>
  );
}

function SortableBlockRow({
  block,
  selected,
  onSelect,
  onRemove,
  onToggleHidden,
  onDuplicate,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onToggleHidden: () => void;
  onDuplicate: () => void;
}) {
  const def = BLOCK_REGISTRY[block.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const summary = getBlockSummary(block);
  const isHidden = !!block.hidden;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group border rounded-md px-2 py-2 cursor-pointer flex items-start gap-2 transition ${
        selected
          ? 'border-brand-500 bg-brand-50'
          : isHidden
            ? 'border-dashed border-ink-200 bg-canvas/40'
            : 'border-line hover:border-ink-300 bg-white'
      }`}
      onClick={onSelect}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="text-ink-400 hover:text-ink-700 cursor-grab active:cursor-grabbing px-1 pt-0.5 shrink-0"
        title="Drag to reorder"
        aria-label="Drag handle"
      >
        ⋮⋮
      </button>
      <span className={`text-base pt-0.5 shrink-0 ${isHidden ? 'opacity-50' : ''}`} aria-hidden>{def?.icon as any}</span>
      <div className={`flex-1 min-w-0 ${isHidden ? 'opacity-60' : ''}`}>
        <div className="text-[13px] font-semibold text-ink-900 truncate leading-tight flex items-center gap-1.5">
          <span className={isHidden ? 'line-through' : ''}>{def?.label ?? block.type}</span>
          {isHidden && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
              Hidden
            </span>
          )}
        </div>
        {summary && summary !== '—' && (
          <div className="text-[11px] text-ink-500 truncate leading-snug mt-0.5">
            {summary}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleHidden();
        }}
        className={`px-1 shrink-0 pt-0.5 transition ${isHidden ? 'text-amber-700 hover:text-amber-900' : 'opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-900'}`}
        title={isHidden ? 'Show on storefront' : 'Hide from storefront'}
        aria-label={isHidden ? 'Show block' : 'Hide block'}
        aria-pressed={isHidden}
      >
        {isHidden ? (
          // eye-off
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        ) : (
          // eye
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-ink-900 px-1 shrink-0 pt-0.5 transition"
        title="Duplicate"
        aria-label="Duplicate block"
      >
        {/* copy/duplicate icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 px-1 shrink-0 pt-0.5"
        title="Delete"
        aria-label="Delete block"
      >
        ×
      </button>
    </li>
  );
}
