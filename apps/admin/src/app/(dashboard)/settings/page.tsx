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
  // Invoice identity + returns
  const [legalName, setLegalName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [returnDays, setReturnDays] = useState('7');
  const [savingId, setSavingId] = useState(false);

  useEffect(() => {
    api<Record<string, string>>('/api/admin/settings')
      .then((s) => {
        setCodEnabled(s.cod_enabled === 'true');
        setLegalName(s.platform_legal_name ?? '');
        setGstin(s.platform_gstin ?? '');
        setAddress(s.platform_address ?? '');
        setReturnDays(s.return_window_days ?? '7');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function saveIdentity() {
    setSavingId(true);
    try {
      await api('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ updates: {
          platform_legal_name: legalName,
          platform_gstin: gstin,
          platform_address: address,
          return_window_days: returnDays,
        } }),
      });
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally { setSavingId(false); }
  }

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

      {!loading && (
        <Card className="max-w-lg mt-6">
          <div className="px-5 py-4 border-b border-line">
            <h2 className="font-semibold text-ink-900">Invoicing &amp; returns</h2>
            <p className="text-xs text-ink-500 mt-0.5">Identity printed on GST invoices, and the customer return window.</p>
          </div>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink-900">Platform legal name</span>
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="e.g. Vrindaonline Retail Pvt Ltd"
                className="mt-1 w-full px-3 py-2 rounded-md border border-line text-sm bg-surface" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-900">Platform GSTIN</span>
              <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5"
                className="mt-1 w-full px-3 py-2 rounded-md border border-line text-sm bg-surface font-mono" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-900">Registered address</span>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2 rounded-md border border-line text-sm bg-surface" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-900">Return window (days)</span>
              <input type="number" min={1} max={90} value={returnDays} onChange={(e) => setReturnDays(e.target.value)}
                className="mt-1 w-32 px-3 py-2 rounded-md border border-line text-sm bg-surface" />
            </label>
            <button onClick={saveIdentity} disabled={savingId} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">
              {savingId ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
