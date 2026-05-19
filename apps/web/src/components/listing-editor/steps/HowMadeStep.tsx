'use client';
import { StepHeader, StepProps, ComingSoonBadge } from '../StepShell';
import { WhoMade, WhatIsIt } from '../types';

const WHO: { value: WhoMade; label: string }[] = [
  { value: 'I_DID',           label: 'I did' },
  { value: 'TEAM',            label: 'A member of my shop' },
  { value: 'ANOTHER_COMPANY', label: 'Another company or person' },
];

const WHAT: { value: WhatIsIt; label: string }[] = [
  { value: 'FINISHED', label: 'A finished product' },
  { value: 'SUPPLY',   label: 'A supply or tool to make things' },
];

export function HowMadeStep({ draft, setDraft }: StepProps) {
  return (
    <>
      <StepHeader
        title="How it's made"
        subtitle="Buyers care where your item came from — this also helps the marketplace stay genuine."
      />
      <div className="p-6 space-y-6">
        <RadioGroup
          label="Who made it?"
          required
          options={WHO}
          value={draft.whoMade}
          onChange={(v) => setDraft({ whoMade: v as WhoMade })}
        />
        <RadioGroup
          label="What is it?"
          required
          options={WHAT}
          value={draft.whatIsIt}
          onChange={(v) => setDraft({ whatIsIt: v as WhatIsIt })}
        />

        <div className="rounded-md border border-line p-4 bg-canvas/40">
          <p className="text-sm font-semibold text-ink-900 inline-flex items-center">
            Production partners <ComingSoonBadge />
          </p>
          <p className="text-xs text-ink-500 mt-1">
            A production partner is anyone who's not part of your shop who helps physically produce your items.
          </p>
        </div>

      </div>
    </>
  );
}

function RadioGroup({ label, required, options, value, onChange }: {
  label: string; required?: boolean;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink-900">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </p>
      <div className="mt-3 space-y-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)}
              className={[
                'w-full flex items-center gap-3 p-3 rounded-md border text-left transition',
                active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-line bg-surface hover:border-ink-300',
              ].join(' ')}
            >
              <span className={[
                'h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center',
                active ? 'border-brand-600' : 'border-ink-300',
              ].join(' ')}>
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </span>
              <span className="text-sm text-ink-900">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
