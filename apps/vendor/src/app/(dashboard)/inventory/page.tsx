'use client';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface InvProduct {
  id: string;
  name: string;
  price: string;
  stockQuantity: number;
  status: string;
  isActive: boolean;
  images: string[];
  category: { name: string } | null;
}

const LOW_STOCK = 3;

export default function VendorInventoryPage() {
  const { code } = useCurrency();
  const [items, setItems] = useState<InvProduct[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<InvProduct[]>('/api/products/vendor/mine');
      setItems(Array.isArray(data) ? data : []); setEdits({});
    } catch {
      setItems([]);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const dirty = Object.keys(edits).length > 0;

  async function saveStock() {
    const updates = Object.entries(edits).map(([id, stockQuantity]) => ({ id, stockQuantity }));
    if (updates.length === 0) return;
    setSaving(true);
    try {
      await api('/api/products/vendor/bulk-stock', { method: 'PATCH', body: JSON.stringify({ updates }) });
      toast.success(`Updated stock for ${updates.length} product(s)`);
      load();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function exportCsv() {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const key = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    try {
      const res = await fetch(`${API}/api/products/vendor/bulk-export`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) { toast.error('Export failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'products.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { toast.error('Export failed'); }
  }

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api<{ created: number; failed: number; errors: { row: number; error: string }[] }>(
        '/api/products/vendor/bulk-import', { method: 'POST', body: fd }
      );
      toast.success(`Imported ${r.created} product(s)${r.failed ? `, ${r.failed} failed` : ''} — pending review`);
      if (r.failed && r.errors?.length) {
        console.warn('Import errors:', r.errors);
        toast(`First error: row ${r.errors[0].row} — ${r.errors[0].error}`, { icon: '⚠️' });
      }
      load();
    } catch (e: any) { toast.error(e?.message || 'Import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Update stock in bulk, and import or export your catalogue as CSV."
        actions={
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn-secondary !px-4 !py-2 text-sm">Export CSV</button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary !px-4 !py-2 text-sm disabled:opacity-50">
              {importing ? 'Importing…' : 'Import CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }} />
            {dirty && <button onClick={saveStock} disabled={saving} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : `Save (${Object.keys(edits).length})`}</button>}
          </div>
        }
      />

      <p className="text-xs text-ink-500 mb-4">
        CSV columns: <code>name, description, category (slug), price, stock, sku, metalType, jewelleryType, materials, tags, images, status</code>.
        Use <code>|</code> to separate multiple materials / tags / image URLs. Export first for a ready-made template.
      </p>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No products yet.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold text-right">Price</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold w-32">Stock</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const val = edits[p.id] ?? p.stockQuantity;
                  const low = val <= LOW_STOCK;
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <img src={p.images?.[0] || '/placeholder.png'} alt="" className="h-9 w-9 rounded object-cover bg-canvas" />
                          <span className="font-medium text-ink-900 line-clamp-1">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-ink-700">{p.category?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-right">{formatPrice(Number(p.price), code)}</td>
                      <td className="px-5 py-3">
                        <StatusPill tone={p.status === 'ACTIVE' ? 'success' : p.status === 'PENDING_REVIEW' ? 'warn' : p.status === 'REJECTED' ? 'danger' : 'neutral'}>{p.status.replace(/_/g, ' ')}</StatusPill>
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" min={0} value={val}
                          onChange={(e) => setEdits((m) => ({ ...m, [p.id]: Math.max(0, parseInt(e.target.value || '0', 10) || 0) }))}
                          className={`w-24 px-2 py-1.5 rounded-md border text-sm ${low ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-line bg-surface'}`} />
                        {low && <span className="ml-2 text-xs text-amber-600">low</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
