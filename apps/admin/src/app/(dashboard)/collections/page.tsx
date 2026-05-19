'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface Collection {
  id: string; slug: string; name: string;
  description: string | null;
  imageUrl: string | null;
  bannerUrl: string | null;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImageUrl: string | null;
  _count: { products: number };
}

interface FormState {
  slug: string; name: string; description: string;
  imageUrl: string; bannerUrl: string;
  featured: boolean; sortOrder: string;
  metaTitle: string; metaDescription: string; metaImageUrl: string;
}
const EMPTY: FormState = {
  slug: '', name: '', description: '', imageUrl: '', bannerUrl: '',
  featured: false, sortOrder: '0',
  metaTitle: '', metaDescription: '', metaImageUrl: '',
};

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function AdminCollectionsPage() {
  const [items, setItems] = useState<Collection[]>([]);
  const [err, setErr] = useState('');
  const [add, setAdd] = useState<FormState>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<FormState>(EMPTY);
  const [productsByCol, setProductsByCol] = useState<Record<string, string>>({});

  async function load() {
    try { setItems(await api<Collection[]>('/api/collections/all')); }
    catch (e: any) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  function payload(f: FormState) {
    return {
      slug: f.slug,
      name: f.name,
      description: f.description || null,
      imageUrl: f.imageUrl || null,
      bannerUrl: f.bannerUrl || null,
      featured: f.featured,
      sortOrder: parseInt(f.sortOrder) || 0,
      metaTitle: f.metaTitle || null,
      metaDescription: f.metaDescription || null,
      metaImageUrl: f.metaImageUrl || null,
    };
  }
  function toForm(c: Collection): FormState {
    return {
      slug: c.slug, name: c.name, description: c.description ?? '',
      imageUrl: c.imageUrl ?? '', bannerUrl: c.bannerUrl ?? '',
      featured: c.featured, sortOrder: String(c.sortOrder),
      metaTitle: c.metaTitle ?? '', metaDescription: c.metaDescription ?? '', metaImageUrl: c.metaImageUrl ?? '',
    };
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/collections', { method: 'POST', body: JSON.stringify(payload(add)) });
      setAdd(EMPTY); await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function handleUpdate(id: string) {
    try {
      await api(`/api/collections/${id}`, { method: 'PUT', body: JSON.stringify(payload(edit)) });
      setEditId(null); await load();
    } catch (e: any) { setErr(e.message); }
  }
  async function toggleActive(c: Collection) {
    try { await api(`/api/collections/${c.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !c.isActive }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function toggleFeatured(c: Collection) {
    try { await api(`/api/collections/${c.id}`, { method: 'PUT', body: JSON.stringify({ featured: !c.featured }) }); await load(); }
    catch (e: any) { setErr(e.message); }
  }
  async function remove(id: string) {
    if (!confirm('Delete this collection?')) return;
    try { await api(`/api/collections/${id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { setErr(e.message); }
  }

  async function saveProducts(id: string) {
    const csv = productsByCol[id] || '';
    const ids = csv.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    try {
      await api(`/api/collections/${id}/products`, { method: 'PUT', body: JSON.stringify({ productIds: ids }) });
      await load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div>
      <PageHeader title="Collections" subtitle="Virtual groupings of products (Engagement & Wedding, Bridal, Gifts, etc). Products can live in any number of collections — categories stay separate." />

      {err && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-100 text-danger text-sm p-3 flex justify-between">
          <span>{err}</span>
          <button onClick={() => setErr('')} className="font-bold">×</button>
        </div>
      )}

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-ink-900 mb-3">Add a collection</h3>
        <CollectionForm value={add} onChange={setAdd} onSubmit={handleAdd} submitLabel="Add" />
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No collections yet.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover border border-line" />
                ) : (
                  <div className="h-12 w-12 rounded-md bg-canvas border border-line" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-900">{c.name}</span>
                    <span className="text-xs text-ink-500">/{c.slug}</span>
                    <span className="text-xs text-ink-500">· #{c.sortOrder}</span>
                    <span className="text-xs text-ink-500">· {c._count.products} product{c._count.products === 1 ? '' : 's'}</span>
                    {c.featured && <StatusPill tone="info">Featured</StatusPill>}
                  </div>
                  {c.description && <p className="text-xs text-ink-500 truncate mt-0.5">{c.description}</p>}
                </div>
                <StatusPill tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</StatusPill>
                <button onClick={() => { setEditId(editId === c.id ? null : c.id); setEdit(toForm(c)); }}
                  className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">
                  {editId === c.id ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => toggleFeatured(c)} className="text-xs px-3 py-1.5 rounded-pill border border-line hover:border-ink-900">
                  {c.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button onClick={() => toggleActive(c)} className={`text-xs px-3 py-1.5 rounded-pill border ${c.isActive ? 'bg-amber-50 text-warn border-amber-100' : 'bg-emerald-50 text-success border-emerald-100'}`}>
                  {c.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => remove(c.id)} className="text-xs px-3 py-1.5 rounded-pill bg-red-50 text-danger border border-red-100">Delete</button>
              </div>

              {editId === c.id && (
                <div className="px-5 py-4 border-t border-line">
                  <CollectionForm value={edit} onChange={setEdit}
                    onSubmit={(e) => { e.preventDefault(); handleUpdate(c.id); }}
                    submitLabel="Save"
                    onCancel={() => setEditId(null)} />

                  <div className="mt-4 rounded-md border border-line p-3 bg-canvas/40">
                    <p className="text-sm font-semibold text-ink-900 mb-1">Products in this collection</p>
                    <p className="text-xs text-ink-500 mb-2">Paste product IDs (comma- or newline-separated). Sets the full membership — anything not listed is removed.</p>
                    <textarea className="input-field min-h-[80px] text-xs font-mono"
                      value={productsByCol[c.id] || ''}
                      placeholder="<uuid>, <uuid>, …"
                      onChange={(e) => setProductsByCol((p) => ({ ...p, [c.id]: e.target.value }))} />
                    <button onClick={() => saveProducts(c.id)} className="mt-2 btn-primary !px-3 !py-1.5 text-xs">Save product set</button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionForm({ value, onChange, onSubmit, submitLabel, onCancel }: {
  value: FormState; onChange: (v: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="input-field md:col-span-2" placeholder="Name" required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value, slug: value.slug || toSlug(e.target.value) })} />
        <input className="input-field" placeholder="Slug" required
          value={value.slug} onChange={(e) => onChange({ ...value, slug: e.target.value })} />
        <input className="input-field" type="number" min="0" placeholder="Order"
          value={value.sortOrder} onChange={(e) => onChange({ ...value, sortOrder: e.target.value })} />
      </div>
      <input className="input-field" placeholder="Description"
        value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="input-field" placeholder="Card image URL"
          value={value.imageUrl} onChange={(e) => onChange({ ...value, imageUrl: e.target.value })} />
        <input className="input-field" placeholder="Banner image URL (landing hero)"
          value={value.bannerUrl} onChange={(e) => onChange({ ...value, bannerUrl: e.target.value })} />
      </div>
      <details className="rounded-md border border-line p-3">
        <summary className="text-sm font-semibold text-ink-900 cursor-pointer">SEO meta</summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <input className="input-field" placeholder="Meta title"
            value={value.metaTitle} onChange={(e) => onChange({ ...value, metaTitle: e.target.value })} />
          <input className="input-field" placeholder="Meta image URL"
            value={value.metaImageUrl} onChange={(e) => onChange({ ...value, metaImageUrl: e.target.value })} />
          <textarea className="input-field md:col-span-2 min-h-[60px]" placeholder="Meta description"
            value={value.metaDescription} onChange={(e) => onChange({ ...value, metaDescription: e.target.value })} />
        </div>
      </details>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.featured}
            onChange={(e) => onChange({ ...value, featured: e.target.checked })} />
          Featured
        </label>
        <div className="ml-auto flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="btn-secondary !px-4 !py-2 text-sm">Cancel</button>}
          <button type="submit" className="btn-primary !px-4 !py-2 text-sm">{submitLabel}</button>
        </div>
      </div>
    </form>
  );
}
