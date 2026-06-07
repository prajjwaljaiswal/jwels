'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Card, StatusPill } from '@/components/dashboard/DashboardShell';
import type { ManifestWithShipments } from '@/types/fulfillment';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManifestDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [manifest, setManifest] = useState<ManifestWithShipments | null>(null);
  const [loading, setLoading]   = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<ManifestWithShipments>(`/api/fulfillment/manifest/${params.id}`)
      .then(setManifest)
      .catch(() => toast.error('Failed to load manifest'))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!loading && manifest && searchParams.get('print') === '1') {
      setTimeout(() => handlePrint(), 400);
    }
  }, [loading, manifest, searchParams]);

  function handlePrint() {
    document.body.classList.add('printing-manifest');
    window.print();
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-manifest');
    }, { once: true });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-canvas rounded animate-pulse" />
        <div className="h-64 bg-canvas rounded animate-pulse" />
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="text-center py-16">
        <p className="text-ink-700">Manifest not found.</p>
        <Link href="/manifest" className="btn-primary inline-block mt-4">Back to manifests</Link>
      </div>
    );
  }

  const shipments = manifest.shipments.map((ms) => ms.shipment);

  return (
    <div>
      {/* Screen header — hidden when printing */}
      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <div>
          <Link href="/manifest" className="text-sm text-ink-500 hover:text-ink-900">← Back to manifests</Link>
          <h1 className="text-2xl font-display font-semibold text-ink-900 mt-2">Manifest #{manifest.id.slice(-8).toUpperCase()}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-primary text-sm !py-2 !px-4">
            🖨 Print / Download PDF
          </button>
        </div>
      </div>

      {/* Printable manifest */}
      <div id="manifest-print" ref={printRef}>
        {/* Print header */}
        <div className="mb-6 pb-4 border-b-2 border-ink-900">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">Shipment Manifest</h1>
              <p className="text-sm text-ink-700 mt-1">Manifest ID: {manifest.id.slice(-8).toUpperCase()}</p>
              <p className="text-sm text-ink-700">Date: {fmtDate(manifest.manifestDate)}</p>
              <p className="text-sm text-ink-700">Carrier: {manifest.carrierName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">Total shipments: {manifest.shipmentCount}</p>
              <p className="text-sm text-ink-700">Status: {manifest.status}</p>
            </div>
          </div>
        </div>

        {/* Shipments table */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-ink-900">
              <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide">#</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide">AWB</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide">Order ID</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide">Customer</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide">Destination</th>
              <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide">Product</th>
              <th className="text-right py-2 text-xs font-semibold uppercase tracking-wide">Value</th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s, i) => {
              const addr = s.orderItem.order.shippingAddress;
              return (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-2 pr-4 text-ink-700">{i + 1}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{s.awb ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{s.orderItem.order.id.slice(-8).toUpperCase()}</td>
                  <td className="py-2 pr-4">
                    <p>{s.orderItem.order.customer.name}</p>
                    {s.orderItem.order.customer.phone && (
                      <p className="text-xs text-ink-500">{s.orderItem.order.customer.phone}</p>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <p>{addr?.city}, {addr?.state}</p>
                    <p className="text-xs text-ink-500">PIN {addr?.pincode}</p>
                  </td>
                  <td className="py-2 pr-4">
                    <p className="truncate max-w-[160px]">{s.orderItem.product.name}</p>
                    <p className="text-xs text-ink-500">Qty {s.orderItem.quantity}</p>
                  </td>
                  <td className="py-2 text-right">
                    ₹{s.declaredValue ? Number(s.declaredValue).toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-900">
              <td colSpan={6} className="pt-3 font-semibold text-sm">Total shipments: {shipments.length}</td>
              <td className="pt-3 text-right font-semibold text-sm">
                ₹{shipments.reduce((sum, s) => sum + (s.declaredValue ? Number(s.declaredValue) : 0), 0).toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Print footer */}
        <div className="mt-8 pt-4 border-t border-line text-xs text-ink-500 flex justify-between">
          <span>Generated: {fmtDate(manifest.createdAt)}</span>
          <span>Vendor ID: {manifest.vendorId.slice(-8).toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
