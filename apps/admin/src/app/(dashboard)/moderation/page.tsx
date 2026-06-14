'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface ModProduct {
  id: string;
  name: string;
  price: string;
  images: string[];
  status: string;
  isActive: boolean;
  createdAt: string;
  category: { name: string } | null;
  vendor: { id: string; shopName: string } | null;
}

const TABS = [
  { id: 'PENDING_REVIEW', label: 'Pending review' },
  { id: 'ACTIVE', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
] as const;

export default function AdminModerationPage() {
  const { code } = useCurrency();
  const [items, setItems] = useState<ModProduct[]>([]);
  const [filter, setFilter] = useState<typeof TABS[number]['id']>('PENDING_REVIEW');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api<{ items: ModProduct[] }>(`/api/admin/products?status=${filter}&limit=50`);
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [filter]);

  async function moderate(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      await api(`/api/admin/products/${id}/moderate`, { method: 'PATCH', body: JSON.stringify({ action }) });
      toast.success(action === 'approve' ? 'Product approved & published' : 'Product rejected');
      setItems((arr) => arr.filter((p) => p.id !== id));
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader title="Product moderation" subtitle="New listings stay hidden until approved here. Approving publishes them and adds them to search." />

      <div className="border-b border-line mb-6">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = t.id === filter;
            return (
              <button key={t.id} onClick={() => setFilter(t.id)}
                className={`relative py-3 text-sm whitespace-nowrap ${active ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900'}`}>
                {t.label}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">Nothing here — all clear.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <img src={p.images?.[0] || '/placeholder.png'} alt="" className="h-16 w-16 rounded-md object-cover bg-canvas shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 truncate">{p.name}</p>
                  <p className="text-sm text-ink-700">{formatPrice(Number(p.price), code)} · {p.category?.name ?? '—'}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{p.vendor?.shopName ?? '—'} · submitted {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                {filter === 'PENDING_REVIEW' ? (
                  <div className="flex gap-2 ml-auto">
                    <button disabled={busy === p.id} onClick={() => moderate(p.id, 'approve')} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">Approve</button>
                    <button disabled={busy === p.id} onClick={() => moderate(p.id, 'reject')} className="btn-secondary !px-4 !py-2 text-xs disabled:opacity-50">Reject</button>
                  </div>
                ) : (
                  <StatusPill tone={filter === 'ACTIVE' ? 'success' : 'danger'}>{p.status}</StatusPill>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
