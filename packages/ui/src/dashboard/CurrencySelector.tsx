'use client';
import { useCurrency, CURRENCIES, type CurrencyCode } from '@/lib/currency';

export function CurrencySelector() {
  const { code, setCode } = useCurrency();
  return (
    <select
      value={code}
      onChange={(e) => setCode(e.target.value as CurrencyCode)}
      className="text-sm border border-line rounded-md px-2 py-1 bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400"
      aria-label="Select currency"
    >
      {(Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][]).map(([c, { symbol }]) => (
        <option key={c} value={c}>{symbol} {c}</option>
      ))}
    </select>
  );
}
