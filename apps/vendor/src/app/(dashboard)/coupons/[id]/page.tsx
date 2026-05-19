'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CouponForm, CouponFormValues, emptyValues } from '../CouponForm';

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditCouponPage() {
  const params = useParams<{ id: string }>();
  const [values, setValues] = useState<CouponFormValues | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<any>(`/api/coupons/vendor/${params.id}`)
      .then((c) => {
        setValues({
          ...emptyValues,
          code: c.code,
          scope: c.scope,
          discountType: c.discountType,
          value: String(Number(c.value)),
          minOrderAmount: c.minOrderAmount != null ? String(Number(c.minOrderAmount)) : '',
          maxDiscount: c.maxDiscount != null ? String(Number(c.maxDiscount)) : '',
          usageLimit: c.usageLimit != null ? String(c.usageLimit) : '',
          perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : '',
          startsAt: toLocalInput(c.startsAt),
          expiresAt: toLocalInput(c.expiresAt),
          isActive: c.isActive,
          productIds: (c.products || []).map((p: any) => p.id),
        });
      })
      .catch((e) => setErr(e.message));
  }, [params.id]);

  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href="/coupons" className="hover:text-brand-700">Coupons</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">Edit</span>
      </nav>
      <h1 className="font-display text-3xl text-ink-900 mb-6">Edit coupon</h1>
      {err && <p className="text-danger text-sm">{err}</p>}
      {!values ? <p className="text-sm text-ink-500">Loading…</p> : <CouponForm initial={values} couponId={params.id} />}
    </div>
  );
}
