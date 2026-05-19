'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { Stars } from '@/components/storefront/ProductCard';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  mediaUrls: string[];
  mediaTypes: string[];
  vendorResponse: string | null;
  vendorRespondedAt: string | null;
  isHidden: boolean;
  createdAt: string;
  product: { id: string; name: string; images: string[] };
  customer: { id: string; name: string };
}

interface ReviewsResponse {
  reviews: Review[];
  total: number;
  averageRating: number;
  ratingBreakdown: Record<number, number>;
}

const TABS = [
  { id: 'all',        label: 'All' },
  { id: 'unanswered', label: 'Unanswered' },
  { id: 'answered',   label: 'Answered' },
  { id: 'hidden',     label: 'Hidden' },
] as const;

export default function VendorReviewsPage() {
  const [filter, setFilter] = useState<typeof TABS[number]['id']>('all');
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api<ReviewsResponse>(`/api/vendors/me/reviews?filter=${filter}`);
      setData(d);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function respond(id: string) {
    const text = drafts[id]?.trim();
    if (!text || text.length < 2) return toast.error('Write a response first');
    await api(`/api/vendors/me/reviews/${id}/respond`, {
      method: 'PATCH',
      body: JSON.stringify({ vendorResponse: text }),
    });
    toast.success('Response posted');
    setDrafts((d) => { const c = { ...d }; delete c[id]; return c; });
    setOpen(null);
    load();
  }
  async function toggleHide(id: string) {
    await api(`/api/vendors/me/reviews/${id}/hide`, { method: 'PATCH' });
    load();
  }

  return (
    <div>
      <PageHeader
        title="Reviews"
        subtitle="Reply to customer reviews and hide off-topic or abusive ones."
      />

      {data && data.total > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-ink-900">{data.averageRating.toFixed(1)}</span>
                <Stars value={data.averageRating} size={18} />
              </div>
              <p className="text-xs text-ink-500 mt-1">{data.total} review{data.total !== 1 ? 's' : ''} across your shop</p>
            </div>
            <div className="flex-1 min-w-[240px] space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = data.ratingBreakdown[star] ?? 0;
                const pct = data.total ? (count / data.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs text-ink-700">
                    <span className="w-6 text-right">{star}★</span>
                    <span className="flex-1 h-1.5 rounded-pill bg-canvas overflow-hidden">
                      <span className="block h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <div className="border-b border-line mb-6">
        <div className="flex gap-6">
          {TABS.map((t) => {
            const active = t.id === filter;
            return (
              <button key={t.id} onClick={() => setFilter(t.id)}
                className={`relative py-3 text-sm ${active ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900'}`}>
                {t.label}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : !data || data.reviews.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-ink-900">No reviews to show</p>
          <p className="text-sm text-ink-700 mt-1">
            {filter === 'unanswered' ? 'All caught up! Every review has a response.' :
             filter === 'answered'   ? 'You haven\'t responded to any reviews yet.' :
             filter === 'hidden'     ? 'No reviews have been hidden.' :
             'Reviews from buyers will appear here once your products receive ratings.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((r) => {
            const openHere = open === r.id;
            return (
              <Card key={r.id} className="p-5">
                <div className="flex items-start gap-4">
                  <Link href={`/products/${r.product.id}`} className="shrink-0">
                    <div className="h-14 w-14 rounded-md bg-canvas overflow-hidden">
                      {r.product.images[0] && <img src={r.product.images[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Stars value={r.rating} size={14} />
                      {r.title && <span className="font-semibold text-ink-900 truncate">{r.title}</span>}
                      {r.isHidden && <StatusPill tone="danger">Hidden</StatusPill>}
                      {r.vendorResponse && !r.isHidden && <StatusPill tone="success">Responded</StatusPill>}
                    </div>
                    <p className="text-xs text-ink-500 mt-1">
                      {r.customer.name} · {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      <Link href={`/products/${r.product.id}`} className="hover:text-brand-700">{r.product.name}</Link>
                    </p>
                    {r.body && <p className="text-sm text-ink-700 mt-2 whitespace-pre-line">{r.body}</p>}
                    {r.mediaUrls.length > 0 && (
                      <div className="flex gap-1.5 mt-3">
                        {r.mediaUrls.slice(0, 4).map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="h-14 w-14 rounded-md bg-canvas overflow-hidden">
                            {r.mediaTypes[i] === 'video'
                              ? <video src={u} className="w-full h-full object-cover" muted />
                              : <img src={u} alt="" className="w-full h-full object-cover" />}
                          </a>
                        ))}
                      </div>
                    )}

                    {r.vendorResponse && (
                      <div className="mt-3 rounded-md border border-line bg-canvas/60 p-3">
                        <p className="text-xs uppercase tracking-wide font-semibold text-ink-700">Your response</p>
                        <p className="text-sm text-ink-700 mt-1 whitespace-pre-line">{r.vendorResponse}</p>
                      </div>
                    )}

                    {openHere && (
                      <div className="mt-3">
                        <textarea className="input-field h-24 py-2"
                          placeholder="Thank the customer, address their concern, or offer help."
                          maxLength={1000}
                          value={drafts[r.id] ?? ''}
                          onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))} />
                        <div className="flex items-center justify-end gap-3 mt-2">
                          <button className="btn-secondary text-sm" onClick={() => setOpen(null)}>Cancel</button>
                          <button className="btn-primary text-sm" onClick={() => respond(r.id)}>Post response</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!r.vendorResponse && !openHere && (
                      <button className="btn-primary text-sm" onClick={() => setOpen(r.id)}>Reply</button>
                    )}
                    <button onClick={() => toggleHide(r.id)} className="text-xs text-ink-500 hover:text-danger">
                      {r.isHidden ? 'Unhide' : 'Hide'}
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
