'use client';
import Link from 'next/link';
import { CouponForm, emptyValues } from '../CouponForm';

export default function NewCouponPage() {
  return (
    <div className="max-w-container mx-auto px-6 py-8">
      <nav className="text-xs text-ink-500 mb-4">
        <Link href="/coupons" className="hover:text-brand-700">Coupons</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">New</span>
      </nav>
      <h1 className="font-display text-3xl text-ink-900 mb-6">New coupon</h1>
      <CouponForm initial={emptyValues} />
    </div>
  );
}
