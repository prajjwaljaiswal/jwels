import { ReactNode } from 'react';
import { ListingDraft } from './types';

export interface StepProps {
  draft: ListingDraft;
  setDraft: (patch: Partial<ListingDraft> | ((prev: ListingDraft) => ListingDraft)) => void;
}

export function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-6 py-5 border-b border-line">
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function Field({ label, children, hint, required }: { label: string; children: ReactNode; hint?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-700">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[11px] text-ink-500 font-normal normal-case tracking-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function ComingSoonBadge() {
  return <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Coming soon</span>;
}
