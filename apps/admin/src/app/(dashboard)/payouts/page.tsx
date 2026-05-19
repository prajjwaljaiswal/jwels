'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, KpiCard, Card } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice } from '@/lib/currency';

interface PayoutRow {
  vendorId: string;
  shopName: string;
  email: string;
  itemCount: number;
  gross: number;
  commission: number;
  payable: number;
}

export default function AdminPayoutsPage() {
  const [data, setData] = useState<{ commissionRate: number; vendors: PayoutRow[] } | null>(null);
  const { code } = useCurrency();
  const fmt = (n: number) => formatPrice(n, code);

  useEffect(() => {
    api<{ commissionRate: number; vendors: PayoutRow[] }>('/api/admin/payouts').then(setData);
  }, []);

  if (!data) {
    return (
      <div>
        <PageHeader title="Vendor payouts" />
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      </div>
    );
  }

  const totalGross = data.vendors.reduce((s, v) => s + v.gross, 0);
  const totalCommission = data.vendors.reduce((s, v) => s + v.commission, 0);
  const totalPayable = data.vendors.reduce((s, v) => s + v.payable, 0);

  return (
    <div>
      <PageHeader
        title="Vendor payouts"
        subtitle={`Commission rate ${(data.commissionRate * 100).toFixed(0)}% · calculated from delivered items only.`}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Gross sales" value={fmt(totalGross)} />
        <KpiCard label="Platform commission" value={fmt(totalCommission)} accent="brand" />
        <KpiCard label="Total payable" value={fmt(totalPayable)} accent="success" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-semibold text-ink-900">Payout schedule</h2>
          <button className="btn-secondary !px-4 !py-2 text-xs">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Vendor</th>
                <th className="px-5 py-3 font-semibold">Items sold</th>
                <th className="px-5 py-3 font-semibold text-right">Gross</th>
                <th className="px-5 py-3 font-semibold text-right">Commission</th>
                <th className="px-5 py-3 font-semibold text-right">Payable</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.vendors.map((v) => (
                <tr key={v.vendorId} className="border-t border-line hover:bg-canvas/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-ink-900">{v.shopName}</p>
                    <p className="text-xs text-ink-500">{v.email}</p>
                  </td>
                  <td className="px-5 py-3 text-ink-700">{v.itemCount}</td>
                  <td className="px-5 py-3 text-right">{fmt(v.gross)}</td>
                  <td className="px-5 py-3 text-right text-ink-500">−{fmt(v.commission)}</td>
                  <td className="px-5 py-3 text-right font-bold text-ink-900">{fmt(v.payable)}</td>
                  <td className="px-5 py-3 text-right">
                    <button className="text-xs text-brand-700 font-semibold hover:underline">Mark paid</button>
                  </td>
                </tr>
              ))}
              {data.vendors.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-700">Nothing to pay out yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-ink-500 mt-4">
        Payouts are made via bank transfer or Razorpay Payouts. This view is informational.
      </p>
    </div>
  );
}
