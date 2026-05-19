'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';
import { useCurrency, formatPrice, CURRENCIES } from '@/lib/currency';

interface CouponProduct { id: string; name: string }
interface Coupon {
  id: string;
  code: string;
  scope: 'VENDOR' | 'PRODUCT';
  discountType: 'PERCENT' | 'FLAT';
  value: string;
  minOrderAmount: string | null;
  maxDiscount: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  products: CouponProduct[];
  createdAt: string;
}

export default function VendorCouponsPage() {
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code]?.symbol ?? '₹';
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const list = await api<Coupon[]>('/api/coupons/vendor');
      setCoupons(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon?')) return;
    try {
      const r = await api<{ deleted?: boolean; softDeleted?: boolean }>(`/api/coupons/vendor/${id}`, {
        method: 'DELETE',
      });
      toast.success(r.softDeleted ? 'Coupon disabled (was already used)' : 'Coupon deleted');
      refresh();
    } catch {}
  }

  async function toggleActive(c: Coupon) {
    try {
      await api(`/api/coupons/vendor/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      refresh();
    } catch {}
  }

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle="Create promo codes for your shop. Apply to all products or a curated set."
        actions={<Link href="/coupons/new" className="btn-primary">+ New coupon</Link>}
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-surface border border-line rounded-md animate-pulse" />)}
        </div>
      ) : !coupons || coupons.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-semibold text-ink-900">No coupons yet</p>
          <p className="text-sm text-ink-700 mt-1 mb-5 max-w-md mx-auto">
            Run a sale or thank loyal customers with a promo code. You can limit usage, set expiry, and scope to specific products.
          </p>
          <Link href="/coupons/new" className="btn-primary">Create your first coupon</Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-canvas border-b border-line text-xs uppercase tracking-wide text-ink-700">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Discount</th>
                <th className="text-left px-4 py-3">Scope</th>
                <th className="text-left px-4 py-3">Min order</th>
                <th className="text-left px-4 py-3">Used</th>
                <th className="text-left px-4 py-3">Expires</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-ink-900">{c.code}</td>
                  <td className="px-4 py-3">
                    {c.discountType === 'PERCENT'
                      ? `${Number(c.value)}% off${c.maxDiscount ? ` (max ${formatPrice(Number(c.maxDiscount), code)})` : ''}`
                      : `${formatPrice(Number(c.value), code)} off`}
                  </td>
                  <td className="px-4 py-3">
                    {c.scope === 'VENDOR'
                      ? 'All products'
                      : `${c.products.length} product${c.products.length === 1 ? '' : 's'}`}
                  </td>
                  <td className="px-4 py-3">
                    {c.minOrderAmount ? formatPrice(Number(c.minOrderAmount), code) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`text-xs px-2 py-1 rounded-pill border ${
                        c.isActive
                          ? 'border-success text-success bg-emerald-50'
                          : 'border-line text-ink-500 bg-canvas'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/coupons/${c.id}`} className="text-brand-700 hover:underline mr-3">
                      Edit
                    </Link>
                    <button onClick={() => handleDelete(c.id)} className="text-danger hover:underline">
                      Delete
                    </button>
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
