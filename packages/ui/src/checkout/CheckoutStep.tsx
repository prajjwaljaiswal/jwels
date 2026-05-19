'use client';
import { ReactNode } from 'react';

interface Props {
  index: number;        // 1-based for display
  title: string;
  /** Compact one-line summary shown when this step is complete + collapsed. */
  summary?: ReactNode;
  /** True when the user is currently editing this step (expanded). */
  isActive: boolean;
  /** True when the step's data is valid (passes its own gate). */
  isComplete: boolean;
  /** True when the step is locked — earlier steps not yet complete. */
  isLocked: boolean;
  /** Called when the user clicks Edit on a completed, non-active step. */
  onEdit: () => void;
  children: ReactNode;
}

export function CheckoutStep({ index, title, summary, isActive, isComplete, isLocked, onEdit, children }: Props) {
  return (
    <section
      className={`bg-surface border rounded-md shadow-card transition ${
        isLocked ? 'border-line/60 opacity-60' : 'border-line'
      }`}
    >
      <header className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
              isComplete
                ? 'bg-success text-white'
                : isActive
                  ? 'bg-ink-900 text-white'
                  : 'bg-canvas text-ink-700 border border-line'
            }`}
            aria-hidden
          >
            {isComplete && !isActive ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 4 4L19 6"/>
              </svg>
            ) : index}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink-900 truncate">{title}</h2>
            {!isActive && summary && (
              <p className="text-xs text-ink-700 truncate mt-0.5">{summary}</p>
            )}
          </div>
        </div>
        {isComplete && !isActive && !isLocked && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-brand-700 hover:underline shrink-0"
          >
            Edit
          </button>
        )}
      </header>

      {isActive && <div className="p-5">{children}</div>}
    </section>
  );
}
