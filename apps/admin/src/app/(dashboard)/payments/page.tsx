'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { usePermissions } from '@/lib/permissions';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

type Provider = 'RAZORPAY' | 'UPI_MANUAL' | 'BANK_TRANSFER' | 'COD';

interface AdminMethod {
  id: string;
  provider: Provider;
  label: string;
  mode: 'TEST' | 'LIVE';
  isActive: boolean;
  isDefault: boolean;
  publicConfig: any;
  hasCredentials: boolean;
  lastVerifiedAt: string | null;
  verifyStatus: string | null;
  orderCount: number;
  createdAt: string;
  vendor: { id: string; shopName: string; user: { name: string; email: string } };
}

const PROVIDERS: Provider[] = ['RAZORPAY', 'UPI_MANUAL', 'BANK_TRANSFER', 'COD'];
const PROVIDER_LABEL: Record<Provider, string> = {
  RAZORPAY: 'Razorpay',
  UPI_MANUAL: 'UPI manual',
  BANK_TRANSFER: 'Bank transfer',
  COD: 'COD',
};

export default function AdminPaymentsPage() {
  const { has } = usePermissions();
  const canManage = has('PAYMENT_METHOD_MANAGE');

  const [rows, setRows] = useState<AdminMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | ''>('');
  const [active, setActive] = useState<'' | 'true' | 'false'>('');
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (provider) params.set('provider', provider);
      if (active) params.set('active', active);
      if (q) params.set('q', q);
      setRows(await api<AdminMethod[]>(`/api/payments/admin/methods?${params}`));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function setActiveFlag(m: AdminMethod, isActive: boolean) {
    if (!canManage) return;
    if (!isActive && !confirm(`Deactivate "${m.label}" for ${m.vendor.shopName}? Customers can no longer pay via this method.`)) return;
    try {
      await api(`/api/payments/admin/methods/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      toast.success(isActive ? 'Reactivated' : 'Deactivated');
      load();
    } catch {}
  }

  // Aggregate stats for the header
  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    untested: rows.filter((r) => !r.lastVerifiedAt).length,
    failing: rows.filter((r) => r.verifyStatus && r.verifyStatus !== 'ok').length,
  };

  return (
    <div>
      <PageHeader
        title="Payment methods"
        subtitle="Every vendor's configured payment methods. Credentials are encrypted at rest and never visible here."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} tone="success" />
        <Stat label="Never tested" value={stats.untested} tone={stats.untested > 0 ? 'warn' : 'neutral'} />
        <Stat label="Failing tests" value={stats.failing} tone={stats.failing > 0 ? 'danger' : 'neutral'} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        className="mb-5 flex flex-wrap gap-2 items-end"
      >
        <label className="block text-xs">
          <span className="text-ink-700">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Shop name, vendor email, label"
            className="mt-1 rounded-md border border-line px-3 py-2 text-sm w-72"
          />
        </label>
        <label className="block text-xs">
          <span className="text-ink-700">Provider</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider | '')} className="mt-1 rounded-md border border-line px-3 py-2 text-sm">
            <option value="">All</option>
            {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-ink-700">Status</span>
          <select value={active} onChange={(e) => setActive(e.target.value as '' | 'true' | 'false')} className="mt-1 rounded-md border border-line px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
        <button type="submit" className="btn-secondary !px-4 !py-2 text-sm">Apply</button>
        <button
          type="button"
          onClick={() => { setProvider(''); setActive(''); setQ(''); setTimeout(load, 0); }}
          className="text-xs text-ink-700 hover:text-ink-900 px-2 py-2"
        >Reset</button>
      </form>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">No payment methods match.</Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-ink-700 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Vendor</th>
                <th className="text-left px-4 py-2">Method</th>
                <th className="text-left px-4 py-2">Mode</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Last test</th>
                <th className="text-left px-4 py-2"># Orders</th>
                <th className="text-right px-4 py-2">{canManage ? 'Action' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <Link href={`/vendors`} className="font-semibold text-ink-900 hover:text-brand-700">{r.vendor.shopName}</Link>
                    <div className="text-xs text-ink-500">{r.vendor.user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[11px] text-ink-500 font-mono">{PROVIDER_LABEL[r.provider]} · {summarize(r)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={r.mode === 'LIVE' ? 'success' : 'warn'}>{r.mode}</StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    {r.isActive ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="danger">Inactive</StatusPill>}
                    {r.isDefault && <span className="ml-1"><StatusPill tone="info">Default</StatusPill></span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.lastVerifiedAt ? (
                      <>
                        <div className={r.verifyStatus === 'ok' ? 'text-emerald-700' : 'text-red-600'}>
                          {r.verifyStatus === 'ok' ? 'OK' : (r.verifyStatus ?? 'unknown')}
                        </div>
                        <div className="text-ink-500">{new Date(r.lastVerifiedAt).toLocaleString()}</div>
                      </>
                    ) : <span className="text-ink-500">Never</span>}
                  </td>
                  <td className="px-4 py-3">{r.orderCount}</td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      r.isActive ? (
                        <button onClick={() => setActiveFlag(r, false)} className="text-xs px-3 py-1.5 rounded-pill bg-red-50 text-danger border border-red-100">Deactivate</button>
                      ) : (
                        <button onClick={() => setActiveFlag(r, true)} className="text-xs px-3 py-1.5 rounded-pill bg-emerald-50 text-emerald-700 border border-emerald-100">Reactivate</button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function summarize(r: AdminMethod): string {
  const c = r.publicConfig ?? {};
  switch (r.provider) {
    case 'RAZORPAY':      return c.keyId ?? '—';
    case 'UPI_MANUAL':    return c.vpa ?? '—';
    case 'BANK_TRANSFER': return [c.bankName, c.ifsc, c.accountLast4 ? `••${c.accountLast4}` : null].filter(Boolean).join(' · ') || '—';
    case 'COD':           return c.notes ?? 'COD';
  }
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'success' | 'warn' | 'danger' | 'neutral' }) {
  const color = tone === 'success' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'danger' ? 'text-danger' : 'text-ink-900';
  return (
    <Card className="p-4">
      <p className="text-[11px] text-ink-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </Card>
  );
}
