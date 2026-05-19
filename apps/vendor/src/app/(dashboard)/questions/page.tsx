'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

interface InboxItem {
  id: string;
  question: string;
  answer: string | null;
  askedByName: string;
  createdAt: string;
  answeredAt: string | null;
  product: { id: string; name: string; images: string[] };
}

type Filter = 'unanswered' | 'answered' | 'all';

export default function VendorQuestionsPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('unanswered');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function load(f: Filter) {
    setLoading(true);
    api<{ items: InboxItem[] }>(`/api/questions/vendor/inbox?filter=${f}`, { silent: true })
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter); }, [filter]);

  async function submitAnswer(id: string) {
    const answer = (draft[id] ?? '').trim();
    if (answer.length < 1) { toast.error('Please write an answer'); return; }
    setBusyId(id);
    try {
      await api(`/api/questions/${id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
      toast.success('Answer posted');
      setDraft((d) => ({ ...d, [id]: '' }));
      load(filter);
    } catch {} finally {
      setBusyId(null);
    }
  }

  async function hide(id: string) {
    if (!window.confirm('Hide this question from the product page?')) return;
    await api(`/api/questions/${id}`, { method: 'DELETE' });
    toast.success('Question hidden');
    load(filter);
  }

  return (
    <div>
      <PageHeader
        title="Customer questions"
        subtitle="Answer pre-purchase questions to build buyer trust. Replies show on the product page."
        actions={
          <div className="inline-flex bg-canvas border border-line rounded-pill p-1">
            {(['unanswered', 'answered', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-8 text-xs font-semibold rounded-pill ${filter === f ? 'bg-surface shadow-card text-ink-900' : 'text-ink-700'}`}
              >
                {f === 'unanswered' ? 'Unanswered' : f === 'answered' ? 'Answered' : 'All'}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-ink-900">Nothing in this view</p>
          <p className="text-sm text-ink-700 mt-1 max-w-md mx-auto">
            {filter === 'unanswered'
              ? 'All caught up — every question has a reply.'
              : 'When customers ask questions on your listings, they\'ll appear here.'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((q) => (
            <li key={q.id} className="bg-surface border border-line rounded-md p-4">
              <div className="flex gap-3">
                <Link href={`/products/${q.product.id}`} className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-canvas">
                  {q.product.images[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.product.images[0]} alt="" className="w-full h-full object-cover" />
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/products/${q.product.id}`} className="text-sm font-semibold text-ink-900 line-clamp-1 hover:underline">{q.product.name}</Link>
                  <p className="text-sm text-ink-900 mt-1"><span className="font-bold">Q.</span> {q.question}</p>
                  <p className="text-xs text-ink-500 mt-0.5">Asked by {q.askedByName} · {new Date(q.createdAt).toLocaleString('en-IN')}</p>

                  {q.answer ? (
                    <div className="mt-3 pl-3 border-l-2 border-brand-200">
                      <p className="text-sm text-ink-900"><span className="font-bold text-brand-700">A.</span> {q.answer}</p>
                      <p className="text-xs text-ink-500 mt-0.5">{q.answeredAt ? new Date(q.answeredAt).toLocaleString('en-IN') : ''}</p>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <textarea
                        className="input-field min-h-[64px]"
                        placeholder="Write a helpful answer…"
                        value={draft[q.id] ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button disabled={busyId === q.id} className="btn-primary !py-2 !px-4 text-sm" onClick={() => submitAnswer(q.id)}>
                          {busyId === q.id ? 'Posting…' : 'Post answer'}
                        </button>
                        <button className="btn-secondary !py-2 !px-4 text-sm" onClick={() => hide(q.id)}>Hide</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
