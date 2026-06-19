'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { supportApi } from '@/lib/support/api';
import { TICKET_CATEGORIES, CATEGORY_LABELS } from '@/lib/support/types';
import type { TicketCategory } from '@/lib/support/types';

export default function NewSupportRequestPage() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('OTHER');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Context links passed from product / order pages (read from the URL once).
  const [ctx, setCtx] = useState<{ vendorId?: string; productId?: string; orderId?: string }>({});
  const [sellerName, setSellerName] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace('/login?next=/account/support/new'); return; }
    const sp = new URLSearchParams(window.location.search);
    const next = {
      vendorId: sp.get('vendor') || undefined,
      productId: sp.get('product') || undefined,
      orderId: sp.get('order') || undefined,
    };
    setCtx(next);
    if (next.orderId) setCategory('ORDER');
    else if (next.productId) setCategory('PRODUCT');
    // Best-effort seller name for the header.
    if (next.vendorId) {
      api<{ shopName?: string }>(`/api/vendors/${next.vendorId}`, { silent: true, auth: false })
        .then((v) => setSellerName(v?.shopName ?? null))
        .catch(() => {});
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || body.trim().length < 1) {
      toast.error('Please add a subject and a message');
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await supportApi.createTicket({
        subject: subject.trim(),
        category,
        body: body.trim(),
        vendorId: ctx.vendorId,
        productId: ctx.productId,
        orderId: ctx.orderId,
      });
      toast.success('Request sent');
      router.replace(`/account/support/${ticket.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not send your request');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl text-ink-900">New request</h1>
      <p className="text-sm text-ink-500 mt-1 mb-6">
        {ctx.vendorId ? `Contacting ${sellerName || 'the seller'}` : 'Contacting Vrindaonline support'}
        {ctx.orderId ? ` · Order #${ctx.orderId.slice(0, 8)}` : ''}
      </p>

      <form onSubmit={onSubmit} className="bg-surface border border-line rounded-md p-6 shadow-card space-y-4">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Subject</span>
          <input className="input-field" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary" required minLength={3} maxLength={160} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Topic</span>
          <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Message</span>
          <textarea className="input-field min-h-[140px]" value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="How can we help?" required maxLength={5000} />
        </label>
        <p className="text-[11px] text-ink-400">
          For your safety, please keep the conversation on Vrindaonline. Don't share passwords or full card numbers.
        </p>
        <button disabled={submitting} className="btn-primary">{submitting ? 'Sending…' : 'Send request'}</button>
      </form>
    </div>
  );
}
