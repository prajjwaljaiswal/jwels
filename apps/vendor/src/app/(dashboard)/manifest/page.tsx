'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import type { Manifest, ShipmentWithOrderItem } from '@/types/fulfillment';

interface CarrierAccount { id: string; carrier: string; accountLabel: string; isActive: boolean; }

function manifestStatusTone(s: string): 'warn' | 'info' | 'success' {
  if (s === 'CLOSED') return 'success';
  if (s === 'SUBMITTED') return 'info';
  return 'warn';
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManifestPage() {
  const searchParams = useSearchParams();
  const preselect = searchParams.get('select');

  const [manifests, setManifests]         = useState<Manifest[]>([]);
  const [labelShipments, setLabelShipments] = useState<ShipmentWithOrderItem[]>([]);
  const [carrierAccounts, setCarrierAccounts] = useState<CarrierAccount[]>([]);
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set(preselect ? [preselect] : []));
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [creating, setCreating]           = useState(false);
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s, c] = await Promise.all([
        api<{ manifests: Manifest[] }>('/api/fulfillment/manifest?limit=50'),
        api<{ shipments: ShipmentWithOrderItem[] }>('/api/fulfillment/shipments?status=LABEL_GENERATED&limit=200'),
        api<CarrierAccount[]>('/api/shipping/vendor/accounts'),
      ]);
      setManifests(m.manifests);
      setLabelShipments(s.shipments);
      setCarrierAccounts(c.filter((a) => a.isActive));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleShipment(id: string) {
    setSelectedShipments((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createManifest() {
    if (!selectedCarrier) { toast.error('Select a carrier'); return; }
    if (!selectedShipments.size) { toast.error('Select at least one shipment'); return; }
    setCreating(true);
    try {
      await api('/api/fulfillment/manifest', {
        method: 'POST',
        body: JSON.stringify({ carrierName: selectedCarrier, shipmentIds: Array.from(selectedShipments) }),
      });
      toast.success('Manifest created');
      setSelectedShipments(new Set());
      setSelectedCarrier('');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create manifest');
    } finally {
      setCreating(false);
    }
  }

  function printManifest(manifestId: string) {
    window.location.href = `/manifest/${manifestId}?print=1`;
  }

  return (
    <div>
      <PageHeader title="Manifest" subtitle="Batch shipments into a carrier manifest for pickup." />

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Create manifest panel */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Create Manifest</h2>

            {/* Carrier selection */}
            <div className="mb-4">
              <label className="text-xs text-ink-500 mb-1.5 block">Carrier *</label>
              <select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="text-sm border border-line rounded-md px-2.5 py-2 bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 w-full"
              >
                <option value="">Select carrier…</option>
                {carrierAccounts.map((a) => (
                  <option key={a.id} value={a.carrier}>{a.carrier} – {a.accountLabel}</option>
                ))}
              </select>
            </div>

            {/* Shipments checklist */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-ink-500">Shipments with label generated ({labelShipments.length})</label>
                {labelShipments.length > 0 && (
                  <button
                    className="text-xs text-brand-700 hover:underline"
                    onClick={() => {
                      if (selectedShipments.size === labelShipments.length) setSelectedShipments(new Set());
                      else setSelectedShipments(new Set(labelShipments.map((s) => s.id)));
                    }}
                  >
                    {selectedShipments.size === labelShipments.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-canvas rounded animate-pulse" />)}
                </div>
              ) : labelShipments.length === 0 ? (
                <p className="text-sm text-ink-500 py-4 text-center">No shipments with generated labels.</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {labelShipments.map((s) => {
                    const addr = s.orderItem.order.shippingAddress;
                    return (
                      <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-md border border-line hover:border-brand-300 cursor-pointer has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/30 transition">
                        <input
                          type="checkbox"
                          checked={selectedShipments.has(s.id)}
                          onChange={() => toggleShipment(s.id)}
                          className="w-4 h-4 accent-brand-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">{s.orderItem.product.name}</p>
                          <p className="text-xs text-ink-500">
                            {s.awb ? `AWB: ${s.awb}` : 'No AWB'} · {addr?.city}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <span className="text-sm text-ink-700">{selectedShipments.size} shipment{selectedShipments.size !== 1 ? 's' : ''} selected</span>
              <button
                onClick={createManifest}
                disabled={creating || !selectedShipments.size || !selectedCarrier}
                className="btn-primary text-sm !py-2 !px-5"
              >
                {creating ? 'Creating…' : 'Create manifest'}
              </button>
            </div>
          </Card>
        </div>

        {/* Manifest history */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Manifest History</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-14 bg-canvas rounded animate-pulse" />)}
              </div>
            ) : manifests.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-4">No manifests yet.</p>
            ) : (
              <div className="space-y-2">
                {manifests.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-3 border border-line rounded-md">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{m.carrierName}</p>
                      <p className="text-xs text-ink-500">{fmtDate(m.manifestDate)} · {m.shipmentCount} shipment{m.shipmentCount !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusPill tone={manifestStatusTone(m.status)}>{m.status}</StatusPill>
                      <button
                        onClick={() => printManifest(m.id)}
                        className="text-xs text-brand-700 hover:underline"
                      >
                        Print ↗
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
