'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface Vendor {
  id: string;
  shopName: string;
  description: string | null;
  status: string;
  createdAt: string;
  user: { name: string; email: string; phone: string | null };
}

const TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUSPENDED', label: 'Suspended' },
] as const;

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filter, setFilter] = useState<typeof TABS[number]['id']>('PENDING');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api<Vendor[]>(`/api/admin/vendors?status=${filter}`);
      setVendors(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [filter]);

  async function setStatus(id: string, status: string) {
    await api(`/api/admin/vendors/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    toast.success(`Vendor ${status.toLowerCase()}`);
    load();
  }

  function statusTone(s: string) {
    return s === 'APPROVED' ? 'success' : s === 'PENDING' ? 'warn' : s === 'REJECTED' || s === 'SUSPENDED' ? 'danger' : 'neutral';
  }

  return (
    <div>
      <PageHeader title="Vendor approvals" subtitle="Review applications, KYC, and shop information before they go live." />

      <div className="border-b border-line mb-6">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const active = t.id === filter;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`relative py-3 text-sm whitespace-nowrap ${active ? 'text-ink-900 font-semibold' : 'text-ink-700 hover:text-ink-900'}`}
              >
                {t.label}
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : vendors.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No vendors in this category.</Card>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => (
            <Card key={v.id} className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center shrink-0">
                  {v.shopName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink-900">{v.shopName}</p>
                    <StatusPill tone={statusTone(v.status) as any}>{v.status}</StatusPill>
                  </div>
                  <p className="text-sm text-ink-700 mt-0.5">
                    {v.user.name} · {v.user.email} {v.user.phone && `· ${v.user.phone}`}
                  </p>
                  {v.description && <p className="text-sm text-ink-700 mt-2 line-clamp-2">{v.description}</p>}
                  <p className="text-xs text-ink-500 mt-2">
                    Submitted {new Date(v.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 ml-auto">
                  {v.status !== 'APPROVED' && (
                    <button onClick={() => setStatus(v.id, 'APPROVED')} className="btn-primary !px-4 !py-2 text-xs">Approve</button>
                  )}
                  {v.status !== 'REJECTED' && (
                    <button onClick={() => setStatus(v.id, 'REJECTED')} className="btn-secondary !px-4 !py-2 text-xs">Reject</button>
                  )}
                  {v.status === 'APPROVED' && (
                    <button onClick={() => setStatus(v.id, 'SUSPENDED')} className="text-xs px-4 py-2 rounded-pill bg-amber-50 text-warn border border-amber-100">Suspend</button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
