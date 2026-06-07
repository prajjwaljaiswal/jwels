'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import type { TrackingResponse } from '@/types/fulfillment';

function statusTone(s: string): 'success' | 'info' | 'warn' | 'danger' {
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 'success';
  if (['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'PICKED_UP'].includes(s)) return 'info';
  if (['RTO_INITIATED', 'RTO_DELIVERED', 'CANCELLED'].includes(s)) return 'danger';
  return 'warn';
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type AnyEvent = { eventName: string; eventDescription?: string | null; eventTime: string; eventLocation?: string | null };

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const [awb, setAwb]             = useState(searchParams.get('awb') ?? '');
  const [query, setQuery]         = useState(searchParams.get('awb') ?? '');
  const [result, setResult]       = useState<TrackingResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [notFound, setNotFound]   = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    setNotFound(false);
    setResult(null);
    try {
      const data = await api<TrackingResponse>(`/api/fulfillment/tracking/${encodeURIComponent(query.trim())}`);
      setResult(data);
    } catch (e: any) {
      if (e?.message?.includes('404') || e?.message?.toLowerCase().includes('not found')) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (query) search();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge and deduplicate events by time
  const allEvents: AnyEvent[] = result
    ? [
        ...result.dbEvents.map((e) => ({ eventName: e.eventName, eventDescription: e.eventDescription, eventTime: e.eventTime, eventLocation: e.eventLocation })),
        ...result.liveEvents.map((e) => ({ eventName: e.eventName, eventDescription: e.eventDescription, eventTime: e.eventTime, eventLocation: e.eventLocation })),
      ].sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime())
    : [];

  return (
    <div>
      <PageHeader title="Shipment Tracking" subtitle="Track shipments by AWB number." />

      {/* Search */}
      <Card className="p-5 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Enter AWB / tracking number…"
            className="input-base flex-1 text-sm"
          />
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="btn-primary text-sm !py-2 !px-5"
          >
            {loading ? 'Searching…' : 'Track'}
          </button>
        </div>
      </Card>

      {/* Result */}
      {notFound && (
        <Card className="p-8 text-center">
          <p className="text-ink-700 font-medium">Shipment not found</p>
          <p className="text-sm text-ink-500 mt-1">No shipment found for AWB <span className="font-mono">{query}</span></p>
        </Card>
      )}

      {result && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Summary card */}
          <Card className="p-6 lg:col-span-1 h-fit">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-4">Shipment Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-ink-500 mb-0.5">AWB</p>
                <p className="text-sm font-mono font-semibold text-ink-900">{result.awb}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 mb-0.5">Carrier</p>
                <p className="text-sm font-medium text-ink-900">{result.carrier}</p>
              </div>
              <div>
                <p className="text-xs text-ink-500 mb-1">Status</p>
                <StatusPill tone={statusTone(result.status)}>{result.status.replace(/_/g, ' ')}</StatusPill>
              </div>
              {result.labelUrl && (
                <a href={result.labelUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-700 hover:underline block">
                  Download label ↗
                </a>
              )}
              {result.trackingUrl && (
                <a
                  href={result.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md transition-colors mt-1"
                >
                  Track on {result.carrier} ↗
                </a>
              )}
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-5">Tracking Timeline</h2>
            {allEvents.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-ink-500">No tracking events synced yet.</p>
                {result.trackingUrl ? (
                  <a
                    href={result.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 border border-brand-300 bg-brand-50 hover:bg-brand-100 px-4 py-2.5 rounded-md transition-colors"
                  >
                    <span>Open live tracking on {result.carrier} website ↗</span>
                  </a>
                ) : (
                  <p className="text-xs text-ink-400">Check back after the shipment is picked up.</p>
                )}
              </div>
            ) : (
              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-line" />
                <div className="space-y-6">
                  {allEvents.map((e, i) => (
                    <div key={i} className="relative">
                      {/* Dot */}
                      <div className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white ${i === 0 ? 'bg-brand-600' : 'bg-ink-400'}`} />
                      <div>
                        <p className={`text-sm font-semibold ${i === 0 ? 'text-ink-900' : 'text-ink-700'}`}>
                          {e.eventName}
                        </p>
                        {e.eventDescription && (
                          <p className="text-xs text-ink-500 mt-0.5">{e.eventDescription}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {e.eventLocation && (
                            <span className="text-xs text-ink-500">📍 {e.eventLocation}</span>
                          )}
                          <span className="text-xs text-ink-400">{fmtDateTime(e.eventTime)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
