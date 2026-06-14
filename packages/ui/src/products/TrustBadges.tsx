'use client';
import type { ReactNode } from 'react';

// Trust strip shown near the buy box / at checkout. Reassures high-consideration
// jewellery & apparel buyers. The hallmark badge only appears for hallmarked
// items (the marketplace also sells fashion jewellery & apparel).

function Badge({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 h-8 w-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-ink-900 leading-tight">{title}</p>
        <p className="text-[11px] text-ink-500 leading-tight">{sub}</p>
      </div>
    </div>
  );
}

const I = {
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  refresh: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6M21 22v-6h-6" /><path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 12a9 9 0 0 0 15 6.7l3-2.7" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>,
  truck: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.5" /><circle cx="18.5" cy="18.5" r="1.5" /></svg>,
};

export function TrustBadges({ hallmarked, className = '' }: { hallmarked?: boolean | null; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 rounded-md border border-line bg-canvas p-4 ${className}`}>
      <Badge icon={I.shield} title="Secure payments" sub="UPI · cards · EMI via Razorpay" />
      <Badge icon={I.refresh} title="Easy returns" sub="Hassle-free refund on eligible items" />
      {hallmarked
        ? <Badge icon={I.check} title="Hallmark verified" sub="BIS HUID on the product page" />
        : <Badge icon={I.check} title="Quality checked" sub="Vendor-verified before listing" />}
      <Badge icon={I.truck} title="Insured delivery" sub="Tracked & insured shipping" />
    </div>
  );
}
