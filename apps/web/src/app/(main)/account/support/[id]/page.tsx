'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { SupportThread } from '@/components/support/SupportThread';

export default function CustomerTicketPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace(`/login?next=/account/support/${id}`); return; }
    setReady(true);
  }, [router, id]);

  if (!ready) return <div className="max-w-3xl mx-auto px-6 py-10 text-sm text-ink-500">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/account/support" className="text-sm text-ink-500 hover:text-brand-700">← All messages</Link>
      <div className="mt-4">
        <SupportThread ticketId={id} />
      </div>
    </div>
  );
}
