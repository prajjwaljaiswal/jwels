'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';
import type { OrderItem, ShipmentInfo } from '../orders/page';

export default function DispatchPage() {
  const { code } = useCurrency();
  const [items, setItems]           = useState<OrderItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [done, setDone]             = useState<Map<string, ShipmentInfo>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await api<OrderItem[]>('/api/vendors/me/orders');
      // Show items ready to dispatch (no label yet) + items with LABEL_GENERATED (re-download)
      const dispatchable = all.filter(
        (i) =>
          (i.status === 'PAID' || i.status === 'PENDING') && !i.shipment ||
          i.shipment?.status === 'LABEL_GENERATED',
      );
      setItems(dispatchable);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function generateLabel(itemId: string) {
    setGenerating((prev) => new Set(prev).add(itemId));
    try {
      const result = await api<ShipmentInfo>(`/api/fulfillment/orders/items/${itemId}/generate-label`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setDone((prev) => new Map(prev).set(itemId, result));
      toast.success(result.awb ? `AWB generated: ${result.awb}` : 'Label created — print manually');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate label');
    } finally {
      setGenerating((prev) => { const n = new Set(prev); n.delete(itemId); return n; });
    }
  }

  async function generateBulk() {
    const ids = Array.from(selected).filter((id) => !done.has(id));
    if (!ids.length) return;
    for (const id of ids) {
      await generateLabel(id);
    }
    setSelected(new Set());
  }

  return (
    <div>
      <PageHeader
        title="Dispatch"
        subtitle="Generate shipping labels for new orders ready to dispatch."
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 bg-brand-600 text-white rounded-md px-4 py-3 mb-4 flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">{selected.size} item{selected.size > 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set())} className="text-sm text-white/80 hover:text-white">
              Clear
            </button>
            <button
              onClick={generateBulk}
              className="text-sm bg-white text-brand-700 font-semibold px-3 py-1.5 rounded-md hover:bg-brand-50 transition"
            >
              Generate labels for {selected.size} item{selected.size > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-ink-700 font-medium">All caught up!</p>
          <p className="text-sm text-ink-500 mt-1">No new orders awaiting dispatch.</p>
          <Link href="/orders" className="btn-primary inline-block mt-4 text-sm">View all orders</Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-1">
            <input
              type="checkbox"
              checked={selected.size === items.length && items.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 accent-brand-600 cursor-pointer"
            />
            <span className="text-xs text-ink-500">Select all ({items.length})</span>
          </div>

          {items.map((it) => {
            const addr = it.order.shippingAddress;
            const isGenerating = generating.has(it.id);
            const shipment = done.get(it.id) ?? it.shipment;
            const isDone = !!shipment?.labelUrl || !!shipment;

            return (
              <Card key={it.id} className={`p-4 flex gap-4 items-center ${isDone ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(it.id)}
                  onChange={() => toggleSelect(it.id)}
                  disabled={isDone || isGenerating}
                  className="w-4 h-4 accent-brand-600 cursor-pointer shrink-0 disabled:opacity-40"
                />
                <div className="h-16 w-16 rounded-md bg-canvas overflow-hidden shrink-0">
                  {it.product.images[0] && (
                    <img src={it.product.images[0]} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 truncate text-sm">{it.product.name}</p>
                  <p className="text-xs text-ink-700">Qty {it.quantity} · {formatPrice(it.priceAtPurchase, code)}</p>
                  <p className="text-xs text-ink-500">
                    {it.order.customer.name} · {addr?.city}, {addr?.pincode}
                  </p>
                  {shipment?.awb && (
                    <p className="text-xs font-mono text-emerald-700 mt-0.5">AWB: {shipment.awb}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {isDone ? (
                    <>
                      <StatusPill tone={shipment?.awb ? 'success' : 'warn'}>
                        {shipment?.awb ? `AWB: ${shipment.awb}` : 'NO AWB'}
                      </StatusPill>
                      {shipment?.labelUrl ? (
                        <a href={shipment.labelUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline font-medium">
                          ↓ Download ↗
                        </a>
                      ) : (
                        <a href={`/orders/${it.id}/label`} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline font-medium">
                          🖨 Print label ↗
                        </a>
                      )}
                      <Link href={`/orders/${it.id}`} className="text-xs text-ink-500 hover:text-ink-900 underline">
                        {shipment?.awb ? 'View order →' : 'Enter AWB →'}
                      </Link>
                    </>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => generateLabel(it.id)}
                        disabled={isGenerating}
                        className="btn-primary text-xs !py-1.5 !px-3"
                      >
                        {isGenerating ? 'Generating…' : 'Generate label'}
                      </button>
                      <Link href={`/orders/${it.id}`} className="text-xs text-ink-500 hover:text-ink-900 underline">
                        Enter AWB manually →
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
