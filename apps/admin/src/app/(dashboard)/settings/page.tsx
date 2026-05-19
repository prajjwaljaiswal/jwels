'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

export default function AdminSettings() {
  const [codEnabled, setCodEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api<{ cod_enabled?: string }>('/api/admin/settings')
      .then((s) => {
        setCodEnabled(s.cod_enabled === 'true');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function toggleCOD(enabled: boolean) {
    setSaving(true);
    setMsg('');
    try {
      await api('/api/admin/settings/cod', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setCodEnabled(enabled);
      const m = enabled ? 'Cash on Delivery enabled' : 'Cash on Delivery disabled';
      setMsg(m);
      toast.success(m);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Platform settings"
        subtitle="Control marketplace-wide features and payment options."
      />

      {loading ? (
        <div className="h-32 bg-surface border border-line rounded-md animate-pulse" />
      ) : (
        <Card className="max-w-lg">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-semibold text-ink-900">Payment methods</h2>
            <p className="text-xs text-ink-500 mt-0.5">Choose which payment options customers can use at checkout.</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Razorpay — always on */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-md border border-line bg-canvas">
              <div>
                <p className="text-sm font-semibold text-ink-900">Online payments (Razorpay)</p>
                <p className="text-xs text-ink-500">UPI, debit/credit cards, netbanking — always enabled</p>
              </div>
              <span className="text-xs font-semibold text-success bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">Always on</span>
            </div>

            {/* COD toggle */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-md border border-line">
              <div>
                <p className="text-sm font-semibold text-ink-900">Cash on Delivery</p>
                <p className="text-xs text-ink-500">Customers pay when their order is delivered</p>
              </div>
              <button
                onClick={() => toggleCOD(!codEnabled)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  codEnabled ? 'bg-brand-600' : 'bg-ink-300'
                }`}
                role="switch"
                aria-checked={codEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    codEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {msg && (
              <p className={`text-sm ${msg.startsWith('Error') ? 'text-danger' : 'text-success'}`}>{msg}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
