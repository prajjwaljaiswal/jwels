'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface KycVendor {
  id: string;
  shopName: string;
  status: string;
  kycStatus: string;
  businessType: string | null;
  legalName: string | null;
  panNumber: string | null;
  gstin: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  idDocumentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  user: { name: string; email: string; phone: string | null };
  pickupAddress: {
    contactName: string; phone: string; line1: string; line2: string | null;
    city: string; state: string; postalCode: string; country: string;
  } | null;
}

const TABS = [
  { id: 'UNDER_REVIEW', label: 'Pending review' },
  { id: 'VERIFIED',     label: 'Verified' },
  { id: 'REJECTED',     label: 'Rejected' },
] as const;

export default function AdminKycPage() {
  const [filter, setFilter] = useState<typeof TABS[number]['id']>('UNDER_REVIEW');
  const [vendors, setVendors] = useState<KycVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api<KycVendor[]>(`/api/admin/vendors/kyc-queue?status=${filter}`);
      setVendors(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function decide(id: string, decision: 'VERIFIED' | 'REJECTED') {
    if (decision === 'REJECTED' && !note.trim()) {
      toast.error('Please add a rejection note so the seller knows what to fix');
      return;
    }
    await api(`/api/admin/vendors/${id}/kyc`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, note: note || undefined }),
    });
    toast.success(`KYC ${decision.toLowerCase()}`);
    setOpenId(null);
    setNote('');
    load();
  }

  return (
    <div>
      <PageHeader title="KYC review queue" subtitle="Verify seller identity and business details before they can list." />

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
      ) : vendors.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No vendors in this state.</Card>
      ) : (
        <div className="space-y-4">
          {vendors.map((v) => {
            const open = openId === v.id;
            return (
              <Card key={v.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-lg text-ink-900">{v.shopName}</h3>
                      <StatusPill tone={v.kycStatus === 'VERIFIED' ? 'success' : v.kycStatus === 'REJECTED' ? 'danger' : 'warn'}>
                        {v.kycStatus.replace('_', ' ')}
                      </StatusPill>
                    </div>
                    <p className="text-sm text-ink-700 mt-0.5">
                      {v.user.name} · {v.user.email}{v.user.phone ? ` · ${v.user.phone}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setOpenId(open ? null : v.id); setNote(''); }} className="btn-secondary text-sm">
                      {open ? 'Close' : 'Review'}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="mt-5 pt-5 border-t border-line grid md:grid-cols-2 gap-6">
                    <DetailGroup title="Business">
                      <Detail label="Type" value={v.businessType ?? '—'} />
                      <Detail label="Legal name" value={v.legalName ?? '—'} />
                      <Detail label="PAN" value={v.panNumber ?? '—'} mono />
                      <Detail label="GSTIN" value={v.gstin ?? '—'} mono />
                    </DetailGroup>
                    <DetailGroup title="Bank">
                      <Detail label="Account holder" value={v.bankAccountName ?? '—'} />
                      <Detail label="Account #" value={v.bankAccountNumber ?? '—'} mono />
                      <Detail label="IFSC" value={v.bankIfsc ?? '—'} mono />
                    </DetailGroup>
                    <DetailGroup title="Pickup address">
                      {v.pickupAddress ? (
                        <p className="text-sm text-ink-700">
                          {v.pickupAddress.contactName} ({v.pickupAddress.phone})<br />
                          {v.pickupAddress.line1}{v.pickupAddress.line2 ? `, ${v.pickupAddress.line2}` : ''}<br />
                          {v.pickupAddress.city}, {v.pickupAddress.state} {v.pickupAddress.postalCode}<br />
                          {v.pickupAddress.country}
                        </p>
                      ) : <p className="text-sm text-ink-500">No address on file</p>}
                    </DetailGroup>
                    <DetailGroup title="ID document">
                      {v.idDocumentUrl ? (
                        <a href={v.idDocumentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-700 font-semibold hover:underline">
                          View document ↗
                        </a>
                      ) : <p className="text-sm text-ink-500">No document on file</p>}
                    </DetailGroup>

                    {filter === 'UNDER_REVIEW' && (
                      <div className="md:col-span-2 border-t border-line pt-5 space-y-3">
                        <label className="block">
                          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Rejection note (only if rejecting)</span>
                          <textarea className="input-field h-20 py-2"
                            placeholder="Explain what's wrong so the seller can fix it"
                            value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                        </label>
                        <div className="flex items-center justify-end gap-3">
                          <button className="btn-secondary text-danger border-danger/40 hover:bg-red-50"
                            onClick={() => decide(v.id, 'REJECTED')}>Reject</button>
                          <button className="btn-primary" onClick={() => decide(v.id, 'VERIFIED')}>Approve & verify</button>
                        </div>
                      </div>
                    )}
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

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wide font-semibold text-ink-700 mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs text-ink-500 w-28 shrink-0">{label}</span>
      <span className={['text-sm text-ink-900', mono ? 'font-mono' : ''].join(' ')}>{value}</span>
    </div>
  );
}
