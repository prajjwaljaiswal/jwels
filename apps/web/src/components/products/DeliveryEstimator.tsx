'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useCurrency, formatPrice } from '@/lib/currency';

interface Props {
  productId: string;
}

interface QuoteOption {
  methodId: string;
  carrier: string;
  name: string;
  amount: number;
  etaMinDays: number;
  etaMaxDays: number;
}
interface QuoteGroup {
  vendorId: string;
  options: QuoteOption[];
}

const STORAGE_KEY = 'deliveryPincode';

function formatDeliveryRange(today: Date, minDays: number, maxDays: number): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const start = new Date(today);
  start.setDate(start.getDate() + minDays);
  const end = new Date(today);
  end.setDate(end.getDate() + maxDays);
  if (minDays === maxDays) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

// Rough Indian PIN → state, used only as a hint when none is provided.
// Server still locks pricing/zones correctly; this just makes the request validate.
function guessStateFromPin(pin: string): string {
  const first = pin.charAt(0);
  const map: Record<string, string> = {
    '1': 'DL', '2': 'UP', '3': 'RJ', '4': 'MH', '5': 'KA',
    '6': 'TN', '7': 'WB', '8': 'BR', '9': 'NA',
  };
  return map[first] ?? 'NA';
}

export function DeliveryEstimator({ productId }: Props) {
  const { code } = useCurrency();
  const [pin, setPin] = useState('');
  const [eta, setEta] = useState<{ minDays: number; maxDays: number; cheapest: number; pin: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved && /^\d{6}$/.test(saved)) {
      setPin(saved);
      void check(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function check(value?: string) {
    const pinValue = value ?? pin;
    if (!/^\d{6}$/.test(pinValue)) {
      setError('Enter a 6-digit PIN code');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api<{ groups: QuoteGroup[] }>('/api/shipping/quote', {
        method: 'POST',
        auth: false,
        silent: true,
        body: JSON.stringify({
          items: [{ productId, quantity: 1 }],
          destination: { postalCode: pinValue, state: guessStateFromPin(pinValue), country: 'IN' },
          paymentMode: 'PREPAID',
        }),
      });
      const options = res.groups.flatMap((g) => g.options);
      if (!options.length) {
        setError('No delivery options for this PIN');
        setEta(null);
        return;
      }
      const cheapest = options.reduce((a, b) => (a.amount <= b.amount ? a : b));
      const fastest = options.reduce((a, b) => (a.etaMinDays <= b.etaMinDays ? a : b));
      setEta({
        minDays: fastest.etaMinDays,
        maxDays: cheapest.etaMaxDays,
        cheapest: cheapest.amount,
        pin: pinValue,
      });
      window.localStorage.setItem(STORAGE_KEY, pinValue);
    } catch (e: any) {
      setError(e?.message ?? 'Could not check delivery');
      setEta(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line rounded-md p-4 bg-canvas/40">
      <div className="flex items-center gap-2 mb-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-700">
          <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        <p className="text-sm font-semibold text-ink-900">Delivery estimate</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void check(); }}
        className="flex gap-2"
      >
        <input
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter PIN code"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="input-field !py-2 flex-1"
        />
        <button disabled={busy} className="btn-secondary !py-2 !px-4 text-sm">
          {busy ? 'Checking…' : eta ? 'Update' : 'Check'}
        </button>
      </form>

      {error && <p className="text-xs text-danger mt-2">{error}</p>}

      {eta && !error && (
        <div className="mt-3 text-sm">
          <p className="text-ink-900">
            Delivers by <span className="font-semibold">{formatDeliveryRange(new Date(), eta.minDays, eta.maxDays)}</span>
          </p>
          <p className="text-xs text-ink-500 mt-0.5">
            to {eta.pin} · from {formatPrice(eta.cheapest, code)} shipping
          </p>
        </div>
      )}
    </div>
  );
}
