'use client';
import { useState } from 'react';
import type { Address, AddressInput } from '@/lib/addresses';

interface Props {
  initial?: Address;
  onSubmit: (input: AddressInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const EMPTY: AddressInput = {
  label: '',
  name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
  country: 'IN',
};

export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address' }: Props) {
  const [form, setForm] = useState<AddressInput>(
    initial
      ? {
          label: initial.label ?? '',
          name: initial.name,
          phone: initial.phone,
          line1: initial.line1,
          line2: initial.line2 ?? '',
          city: initial.city,
          state: initial.state,
          pincode: initial.pincode,
          country: initial.country,
          isDefault: initial.isDefault,
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);

  function set<K extends keyof AddressInput>(k: K, v: AddressInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        label: form.label?.trim() ? form.label : null,
        line2: form.line2?.trim() ? form.line2 : null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Label (optional)</span>
          <input className="input-field" placeholder="Home, Office…" value={form.label ?? ''} onChange={(e) => set('label', e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Full name</span>
          <input className="input-field" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Phone</span>
        <input className="input-field" required inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Address line 1</span>
        <input className="input-field" required value={form.line1} onChange={(e) => set('line1', e.target.value)} />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Address line 2 <span className="text-ink-500 font-normal normal-case">(optional)</span></span>
        <input className="input-field" value={form.line2 ?? ''} onChange={(e) => set('line2', e.target.value)} />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">City</span>
          <input className="input-field" required value={form.city} onChange={(e) => set('city', e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">State</span>
          <input className="input-field" required value={form.state} onChange={(e) => set('state', e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">PIN code</span>
          <input className="input-field" required inputMode="numeric" pattern="\d{6}" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={!!form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
        Set as default address
      </label>

      <div className="flex gap-2 pt-2">
        <button disabled={busy} className="btn-primary">{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        )}
      </div>
    </form>
  );
}
