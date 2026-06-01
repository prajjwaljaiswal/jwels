'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface QA {
  id: string;
  question: string;
  answer: string | null;
  askedByName: string;
  createdAt: string;
  answeredAt: string | null;
}

interface Props {
  productId: string;
}

export function ProductQA({ productId }: Props) {
  const [items, setItems] = useState<QA[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(typeof window !== 'undefined' && !!window.localStorage.getItem('token'));
    api<{ items: QA[] }>(`/api/questions/product/${productId}`, { auth: false, silent: true })
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!authed) {
      toast.error('Sign in to ask a question');
      return;
    }
    if (text.trim().length < 5) {
      toast.error('Question must be at least 5 characters');
      return;
    }
    setBusy(true);
    try {
      const created = await api<QA>('/api/questions', {
        method: 'POST',
        body: JSON.stringify({ productId, question: text.trim() }),
      });
      setItems((cur) => [created, ...cur]);
      setText('');
      toast.success('Question submitted — the seller will respond soon');
    } catch {
    } finally {
      setBusy(false);
    }
  }

  const answered = items.filter((q) => q.answer);
  const pending = items.filter((q) => !q.answer);

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl text-ink-900">Questions & answers</h2>
        <span className="text-sm text-ink-500">{answered.length} answered</span>
      </div>

      <form onSubmit={ask} className="bg-surface border border-line rounded-md p-4 mb-6">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Ask the seller</span>
          <textarea
            className="input-field min-h-[72px]"
            placeholder="e.g. Is this hallmarked? Does it come with a certificate?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
          />
        </label>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-ink-500">
            {authed ? 'Your name will be shown with the question.' : (
              <>You need to <Link href="/login" className="text-brand-700 underline">sign in</Link> to ask a question.</>
            )}
          </p>
          <button disabled={busy} className="btn-primary !py-2 !px-4 text-sm">{busy ? 'Sending…' : 'Submit question'}</button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-ink-700">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-700">No questions yet. Be the first to ask.</p>
      ) : (
        <div className="space-y-4">
          {answered.map((q) => (
            <div key={q.id} className="bg-surface border border-line rounded-md p-4">
              <div className="flex gap-2">
                <span className="font-bold text-ink-900">Q.</span>
                <div className="flex-1">
                  <p className="text-ink-900">{q.question}</p>
                  <p className="text-xs text-ink-500 mt-0.5">Asked by {q.askedByName} · {timeAgo(q.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pl-4 border-l-2 border-brand-200">
                <span className="font-bold text-brand-700">A.</span>
                <div className="flex-1">
                  <p className="text-ink-900">{q.answer}</p>
                  <p className="text-xs text-ink-500 mt-0.5">Seller · {q.answeredAt ? timeAgo(q.answeredAt) : ''}</p>
                </div>
              </div>
            </div>
          ))}
          {pending.length > 0 && (
            <details className="bg-canvas border border-line rounded-md p-4 text-sm">
              <summary className="cursor-pointer text-ink-700">
                {pending.length} question{pending.length === 1 ? '' : 's'} awaiting a response
              </summary>
              <ul className="mt-3 space-y-2">
                {pending.map((q) => (
                  <li key={q.id} className="text-ink-700">
                    <span className="font-semibold text-ink-900">{q.askedByName}:</span> {q.question}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
