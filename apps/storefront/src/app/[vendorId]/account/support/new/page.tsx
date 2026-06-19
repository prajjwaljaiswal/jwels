'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useVendor } from '@/lib/vendor-context';
import { supportApi } from '@/lib/support/api';
import { TICKET_CATEGORIES, CATEGORY_LABELS } from '@/lib/support/types';
import type { TicketCategory } from '@/lib/support/types';

export default function StorefrontNewSupportPage() {
  const router = useRouter();
  const { vendor, theme, basePath } = useVendor();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('OTHER');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ctx, setCtx] = useState<{ productId?: string; orderId?: string }>({});

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const next = `${basePath}/account/support/new`;
    if (!t) { router.replace(`/login?next=${encodeURIComponent(next)}`); return; }
    const sp = new URLSearchParams(window.location.search);
    const c = { productId: sp.get('product') || undefined, orderId: sp.get('order') || undefined };
    setCtx(c);
    if (c.orderId) setCategory('ORDER');
    else if (c.productId) setCategory('PRODUCT');
  }, [router, basePath]);

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
        vendorId: vendor.id, // this storefront's seller
        productId: ctx.productId,
        orderId: ctx.orderId,
      });
      toast.success('Request sent');
      router.replace(`${basePath}/account/support/${ticket.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not send your request');
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-3xl text-ink-900">New request</h1>
      <p className="text-sm text-ink-500 mt-1 mb-6">
        Contacting {vendor.shopName}{ctx.orderId ? ` · Order #${ctx.orderId.slice(0, 8)}` : ''}
      </p>

      <form onSubmit={onSubmit} className="bg-surface border border-line rounded-md p-6 shadow-card space-y-4">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Subject</span>
          <input className="w-full rounded-md border border-line px-3 h-10 text-sm" value={subject}
            onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" required minLength={3} maxLength={160} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Topic</span>
          <select className="w-full rounded-md border border-line px-3 h-10 text-sm" value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Message</span>
          <textarea className="w-full rounded-md border border-line px-3 py-2 text-sm min-h-[140px]" value={body}
            onChange={(e) => setBody(e.target.value)} placeholder="How can we help?" required maxLength={5000} />
        </label>
        <p className="text-[11px] text-ink-400">
          For your safety, please keep the conversation here. Don't share passwords or full card numbers.
        </p>
        <button disabled={submitting} className="px-5 py-2.5 rounded-pill font-semibold text-sm text-white disabled:opacity-50"
          style={{ backgroundColor: theme }}>
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </div>
  );
}
