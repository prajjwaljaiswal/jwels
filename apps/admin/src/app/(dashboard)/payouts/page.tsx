'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, KpiCard, Card, StatusPill } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface PayoutRow {
  vendorId: string; shopName: string; email: string;
  itemCount: number; gross: number; commission: number; payable: number;
}
interface PayoutRun {
  id: string; periodStart: string; periodEnd: string;
  grossAmount: string; commissionAmount: string; netAmount: string;
  status: string; provider: string; utr: string | null; processedAt: string | null;
  vendor: { shopName: string; user: { email: string } } | null;
  _count: { items: number };
}

function ptone(s: string): 'success' | 'warn' | 'danger' | 'neutral' | 'info' {
  if (s === 'PAID') return 'success';
  if (s === 'PENDING') return 'warn';
  if (s === 'FAILED') return 'danger';
  if (s === 'PROCESSING') return 'info';
  return 'neutral';
}

export default function AdminPayoutsPage() {
  const { code } = useCurrency();
  const fmt = (n: number | string) => formatPrice(Number(n), code);
  const [data, setData] = useState<{ commissionRate: number; vendors: PayoutRow[] } | null>(null);
  const [runs, setRuns] = useState<PayoutRun[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [owed, ledger] = await Promise.all([
      api<{ commissionRate: number; vendors: PayoutRow[] }>('/api/admin/payouts'),
      api<PayoutRun[]>('/api/admin/payouts/runs').catch(() => []),
    ]);
    setData(owed); setRuns(ledger);
  }
  useEffect(() => { load(); }, []);

  async function settle() {
    setBusy(true);
    try {
      const r = await api<{ created: number }>('/api/admin/payouts/settle', { method: 'POST', body: '{}' });
      toast.success(r.created > 0 ? `Created ${r.created} payout(s)` : 'No new items to settle');
      load();
    } catch (e: any) { toast.error(e?.message || 'Settlement failed'); }
    finally { setBusy(false); }
  }

  async function markPaid(run: PayoutRun) {
    const utr = window.prompt(`Mark ${fmt(run.netAmount)} to ${run.vendor?.shopName ?? 'vendor'} as paid.\nEnter the bank UTR / transaction reference:`, '');
    if (utr === null) return;
    setBusy(true);
    try {
      await api(`/api/admin/payouts/${run.id}/pay`, { method: 'POST', body: JSON.stringify({ utr }) });
      toast.success('Payout marked paid');
      load();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setBusy(false); }
  }

  if (!data) {
    return (
      <div>
        <PageHeader title="Vendor payouts" />
        <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      </div>
    );
  }

  const totalGross = data.vendors.reduce((s, v) => s + v.gross, 0);
  const totalCommission = data.vendors.reduce((s, v) => s + v.commission, 0);
  const totalPayable = data.vendors.reduce((s, v) => s + v.payable, 0);
  const pendingRuns = runs.filter((r) => r.status === 'PENDING');

  return (
    <div>
      <PageHeader
        title="Vendor payouts"
        subtitle={`Commission ${(data.commissionRate * 100).toFixed(0)}% · settled from delivered items.`}
        actions={<button disabled={busy} onClick={settle} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">Run settlement</button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Owed (unsettled, delivered)" value={fmt(totalPayable)} accent="success" />
        <KpiCard label="Platform commission (owed)" value={fmt(totalCommission)} accent="brand" />
        <KpiCard label="Pending payouts" value={pendingRuns.length} hint={`${runs.length} total runs`} accent={pendingRuns.length ? 'warn' : 'ink'} />
      </div>

      {/* Settlement ledger */}
      <Card className="overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-line"><h2 className="font-semibold text-ink-900">Settlement runs</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Vendor</th>
                <th className="px-5 py-3 font-semibold">Items</th>
                <th className="px-5 py-3 font-semibold text-right">Net payable</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">UTR</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-canvas/50">
                  <td className="px-5 py-3"><p className="font-medium text-ink-900">{r.vendor?.shopName ?? '—'}</p><p className="text-xs text-ink-500">{r.vendor?.user?.email}</p></td>
                  <td className="px-5 py-3 text-ink-700">{r._count.items}</td>
                  <td className="px-5 py-3 text-right font-bold text-ink-900">{fmt(r.netAmount)}</td>
                  <td className="px-5 py-3"><StatusPill tone={ptone(r.status)}>{r.status}</StatusPill></td>
                  <td className="px-5 py-3 text-xs text-ink-500 font-mono">{r.utr || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    {r.status === 'PENDING' && <button disabled={busy} onClick={() => markPaid(r)} className="text-xs text-brand-700 font-semibold hover:underline disabled:opacity-50">Mark paid</button>}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-700">No settlement runs yet — click “Run settlement”.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Live owed summary (pre-settlement) */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-line"><h2 className="font-semibold text-ink-900">Owed by vendor (unsettled)</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Vendor</th>
                <th className="px-5 py-3 font-semibold">Items sold</th>
                <th className="px-5 py-3 font-semibold text-right">Gross</th>
                <th className="px-5 py-3 font-semibold text-right">Commission</th>
                <th className="px-5 py-3 font-semibold text-right">Payable</th>
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.vendorId} className="border-t border-line hover:bg-canvas/50">
                  <td className="px-5 py-3"><p className="font-medium text-ink-900">{v.shopName}</p><p className="text-xs text-ink-500">{v.email}</p></td>
                  <td className="px-5 py-3 text-ink-700">{v.itemCount}</td>
                  <td className="px-5 py-3 text-right">{fmt(v.gross)}</td>
                  <td className="px-5 py-3 text-right text-ink-500">−{fmt(v.commission)}</td>
                  <td className="px-5 py-3 text-right font-bold text-ink-900">{fmt(v.payable)}</td>
                </tr>
              ))}
              {data.vendors.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-700">Nothing owed.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
