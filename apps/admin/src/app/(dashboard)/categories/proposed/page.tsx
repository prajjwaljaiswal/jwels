'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface ProposedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  approvalStatus: 'APPROVED' | 'PROPOSED' | 'REJECTED';
  rejectionNote: string | null;
  createdAt: string;
  parent: { id: string; name: string; slug: string } | null;
  proposer: { id: string; shopName: string; user: { name: string; email: string } } | null;
}

const TABS = [
  { id: 'PROPOSED', label: 'Pending review' },
  { id: 'APPROVED', label: 'Approved'       },
  { id: 'REJECTED', label: 'Rejected'       },
] as const;

export default function AdminProposedCategoriesPage() {
  const [filter, setFilter] = useState<typeof TABS[number]['id']>('PROPOSED');
  const [rows, setRows] = useState<ProposedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api<ProposedCategory[]>(`/api/admin/categories/proposed?status=${filter}`);
      setRows(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    if (decision === 'REJECTED' && !note.trim()) {
      toast.error('Add a rejection note so the vendor knows what to fix');
      return;
    }
    await api(`/api/admin/categories/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, note: note || undefined }),
    });
    toast.success(`Category ${decision.toLowerCase()}`);
    setOpenId(null); setNote('');
    load();
  }

  return (
    <div>
      <PageHeader
        title="Vendor category proposals"
        subtitle="Sellers can suggest new categories. Approve them to add to the global taxonomy, or reject with a note."
      />

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
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No proposals in this state.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const open = openId === c.id;
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-display text-lg text-ink-900">{c.name}</h3>
                      <code className="text-xs text-ink-500 font-mono">{c.slug}</code>
                      <StatusPill tone={c.approvalStatus === 'APPROVED' ? 'success' : c.approvalStatus === 'REJECTED' ? 'danger' : 'warn'}>
                        {c.approvalStatus}
                      </StatusPill>
                    </div>
                    <p className="text-sm text-ink-700 mt-1">
                      Parent: {c.parent ? <span className="font-semibold">{c.parent.name}</span> : <span className="text-ink-500">— top level —</span>}
                      {' · '}
                      Proposed by{' '}
                      {c.proposer
                        ? <span className="font-semibold">{c.proposer.shopName}</span>
                        : <span className="text-ink-500">unknown</span>}
                      {c.proposer && <span className="text-ink-500"> ({c.proposer.user.email})</span>}
                    </p>
                    {c.description && <p className="text-sm text-ink-700 mt-1.5">{c.description}</p>}
                    {c.approvalStatus === 'REJECTED' && c.rejectionNote && (
                      <p className="text-sm text-danger mt-1.5">Note: {c.rejectionNote}</p>
                    )}
                  </div>
                  {filter === 'PROPOSED' && (
                    <button onClick={() => { setOpenId(open ? null : c.id); setNote(''); }} className="btn-secondary text-sm shrink-0">
                      {open ? 'Close' : 'Review'}
                    </button>
                  )}
                </div>

                {open && (
                  <div className="mt-5 pt-5 border-t border-line space-y-3">
                    <label className="block">
                      <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Rejection note (only if rejecting)</span>
                      <textarea className="input-field h-20 py-2"
                        placeholder="e.g. Duplicate of existing 'Diamond Rings' — please use that one"
                        value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                    </label>
                    <div className="flex items-center justify-end gap-3">
                      <button className="btn-secondary text-danger border-danger/40 hover:bg-red-50"
                        onClick={() => decide(c.id, 'REJECTED')}>Reject</button>
                      <button className="btn-primary" onClick={() => decide(c.id, 'APPROVED')}>Approve</button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
