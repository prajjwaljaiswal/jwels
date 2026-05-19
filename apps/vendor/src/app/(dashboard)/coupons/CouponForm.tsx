'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useCurrency, CURRENCIES } from '@/lib/currency';

interface VendorProduct { id: string; name: string }

export interface CouponFormValues {
  code: string;
  scope: 'VENDOR' | 'PRODUCT';
  discountType: 'PERCENT' | 'FLAT';
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  productIds: string[];
}

export const emptyValues: CouponFormValues = {
  code: '',
  scope: 'VENDOR',
  discountType: 'PERCENT',
  value: '',
  minOrderAmount: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: '1',
  startsAt: '',
  expiresAt: '',
  isActive: true,
  productIds: [],
};

function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function num(s: string): number | null {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function intOrNull(s: string): number | null {
  if (!s.trim()) return null;
  const v = parseInt(s, 10);
  return Number.isFinite(v) ? v : null;
}

export function CouponForm({
  initial,
  couponId,
}: {
  initial: CouponFormValues;
  couponId?: string;
}) {
  const router = useRouter();
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code].symbol;
  const [values, setValues] = useState<CouponFormValues>(initial);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<VendorProduct[]>('/api/products/vendor/mine')
      .then((rows) => setProducts(rows.map((r: any) => ({ id: r.id, name: r.name }))))
      .catch(() => {});
  }, []);

  function patch<K extends keyof CouponFormValues>(key: K, v: CouponFormValues[K]) {
    setValues((p) => ({ ...p, [key]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.code.trim()) return toast.error('Code is required');
    const value = num(values.value);
    if (value == null || value <= 0) return toast.error('Discount value is required');
    if (values.discountType === 'PERCENT' && value > 100) return toast.error('Percent cannot exceed 100');
    if (values.scope === 'PRODUCT' && values.productIds.length === 0) {
      return toast.error('Select at least one product');
    }

    const payload = {
      code: values.code.trim().toUpperCase(),
      scope: values.scope,
      discountType: values.discountType,
      value,
      minOrderAmount: num(values.minOrderAmount),
      maxDiscount: num(values.maxDiscount),
      usageLimit: intOrNull(values.usageLimit),
      perUserLimit: intOrNull(values.perUserLimit),
      startsAt: toIsoOrNull(values.startsAt),
      expiresAt: toIsoOrNull(values.expiresAt),
      isActive: values.isActive,
      productIds: values.scope === 'PRODUCT' ? values.productIds : [],
    };

    setSaving(true);
    try {
      if (couponId) {
        await api(`/api/coupons/vendor/${couponId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast.success('Coupon updated');
      } else {
        await api('/api/coupons/vendor', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('Coupon created');
      }
      router.push('/coupons');
    } catch {
      setSaving(false);
    }
  }

  const toggleProduct = (id: string) => {
    setValues((p) => ({
      ...p,
      productIds: p.productIds.includes(id)
        ? p.productIds.filter((x) => x !== id)
        : [...p.productIds, id],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <section className="bg-surface border border-line rounded-md shadow-card p-5 space-y-4">
        <Field label="Code">
          <input
            className="input-field font-mono uppercase"
            placeholder="SAVE10"
            value={values.code}
            onChange={(e) => patch('code', e.target.value.toUpperCase())}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount type">
            <select
              className="input-field"
              value={values.discountType}
              onChange={(e) => patch('discountType', e.target.value as 'PERCENT' | 'FLAT')}
            >
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat ({currencySymbol})</option>
            </select>
          </Field>
          <Field label={values.discountType === 'PERCENT' ? 'Percent off' : `Amount off (${currencySymbol})`}>
            <input
              className="input-field"
              type="number"
              min="0"
              step="0.01"
              value={values.value}
              onChange={(e) => patch('value', e.target.value)}
            />
          </Field>
        </div>

        {values.discountType === 'PERCENT' && (
          <Field label={`Max discount cap (${currencySymbol}, optional)`}>
            <input
              className="input-field"
              type="number"
              min="0"
              step="0.01"
              value={values.maxDiscount}
              onChange={(e) => patch('maxDiscount', e.target.value)}
            />
          </Field>
        )}

        <Field label={`Minimum order amount (${currencySymbol}, optional)`}>
          <input
            className="input-field"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 500 — only applies if subtotal ≥ this"
            value={values.minOrderAmount}
            onChange={(e) => patch('minOrderAmount', e.target.value)}
          />
        </Field>
      </section>

      <section className="bg-surface border border-line rounded-md shadow-card p-5 space-y-4">
        <h2 className="font-semibold text-ink-900">Scope</h2>
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              className="accent-brand-600 mt-1"
              checked={values.scope === 'VENDOR'}
              onChange={() => patch('scope', 'VENDOR')}
            />
            <div>
              <p className="text-sm font-semibold text-ink-900">All my products</p>
              <p className="text-xs text-ink-500">Applies to any item from your shop</p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              className="accent-brand-600 mt-1"
              checked={values.scope === 'PRODUCT'}
              onChange={() => patch('scope', 'PRODUCT')}
            />
            <div>
              <p className="text-sm font-semibold text-ink-900">Specific products</p>
              <p className="text-xs text-ink-500">Choose which products this coupon applies to</p>
            </div>
          </label>
        </div>

        {values.scope === 'PRODUCT' && (
          <div className="border border-line rounded-md max-h-72 overflow-y-auto">
            {products.length === 0 ? (
              <p className="text-sm text-ink-500 p-3">No products yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {products.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-canvas">
                      <input
                        type="checkbox"
                        className="accent-brand-600"
                        checked={values.productIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                      />
                      <span className="text-sm text-ink-900">{p.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="bg-surface border border-line rounded-md shadow-card p-5 space-y-4">
        <h2 className="font-semibold text-ink-900">Limits & validity</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total usage limit (optional)">
            <input
              className="input-field"
              type="number"
              min="1"
              value={values.usageLimit}
              onChange={(e) => patch('usageLimit', e.target.value)}
            />
          </Field>
          <Field label="Per-user limit">
            <input
              className="input-field"
              type="number"
              min="1"
              value={values.perUserLimit}
              onChange={(e) => patch('perUserLimit', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts at (optional)">
            <input
              className="input-field"
              type="datetime-local"
              value={values.startsAt}
              onChange={(e) => patch('startsAt', e.target.value)}
            />
          </Field>
          <Field label="Expires at (optional)">
            <input
              className="input-field"
              type="datetime-local"
              value={values.expiresAt}
              onChange={(e) => patch('expiresAt', e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="accent-brand-600"
            checked={values.isActive}
            onChange={(e) => patch('isActive', e.target.checked)}
          />
          <span className="text-sm text-ink-900">Active</span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : couponId ? 'Save changes' : 'Create coupon'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/coupons')}
          className="px-4 py-2 text-sm text-ink-700 hover:text-brand-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
