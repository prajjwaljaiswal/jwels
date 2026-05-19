'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

type Provider = 'RAZORPAY' | 'UPI_MANUAL' | 'BANK_TRANSFER' | 'COD';
type Mode = 'TEST' | 'LIVE';

interface VendorPaymentMethod {
  id: string;
  provider: Provider;
  label: string;
  mode: Mode;
  isActive: boolean;
  isDefault: boolean;
  publicConfig: any;
  hasCredentials: boolean;
  lastVerifiedAt: string | null;
  verifyStatus: string | null;
}

interface DraftCommon {
  provider: Provider;
  label: string;
  mode: Mode;
  isActive: boolean;
  isDefault: boolean;
}

interface DraftRazorpay extends DraftCommon { provider: 'RAZORPAY'; keyId: string; keySecret: string; webhookSecret: string }
interface DraftUpi      extends DraftCommon { provider: 'UPI_MANUAL'; vpa: string; displayName: string }
interface DraftBank     extends DraftCommon { provider: 'BANK_TRANSFER'; accountHolder: string; accountLast4: string; ifsc: string; bankName: string }
interface DraftCod      extends DraftCommon { provider: 'COD'; notes: string }
type Draft = DraftRazorpay | DraftUpi | DraftBank | DraftCod;

const PROVIDER_LABEL: Record<Provider, string> = {
  RAZORPAY: 'Razorpay',
  UPI_MANUAL: 'UPI (manual)',
  BANK_TRANSFER: 'Bank transfer',
  COD: 'Cash on delivery',
};

function blankDraft(provider: Provider): Draft {
  const common = { provider, label: '', mode: 'TEST' as Mode, isActive: true, isDefault: false };
  switch (provider) {
    case 'RAZORPAY':      return { ...common, provider, keyId: '', keySecret: '', webhookSecret: '' };
    case 'UPI_MANUAL':    return { ...common, provider, vpa: '', displayName: '' };
    case 'BANK_TRANSFER': return { ...common, provider, accountHolder: '', accountLast4: '', ifsc: '', bankName: '' };
    case 'COD':           return { ...common, provider, notes: '' };
  }
}

function buildPayload(d: Draft) {
  const base = { provider: d.provider, label: d.label, mode: d.mode, isActive: d.isActive, isDefault: d.isDefault };
  switch (d.provider) {
    case 'RAZORPAY':
      return {
        ...base,
        credentials: { keyId: d.keyId, keySecret: d.keySecret, ...(d.webhookSecret ? { webhookSecret: d.webhookSecret } : {}) },
      };
    case 'UPI_MANUAL':
      return { ...base, publicConfig: { vpa: d.vpa, displayName: d.displayName } };
    case 'BANK_TRANSFER':
      return {
        ...base,
        publicConfig: {
          accountHolder: d.accountHolder,
          accountLast4: d.accountLast4,
          ...(d.ifsc ? { ifsc: d.ifsc } : {}),
          ...(d.bankName ? { bankName: d.bankName } : {}),
        },
      };
    case 'COD':
      return { ...base, publicConfig: d.notes ? { notes: d.notes } : {} };
  }
}

export default function VendorPaymentsPage() {
  const [methods, setMethods] = useState<VendorPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setMethods(await api<VendorPaymentMethod[]>('/api/payments/vendor/methods'));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startCreate(provider: Provider) {
    setEditingId(null);
    setDraft(blankDraft(provider));
  }

  function startEdit(m: VendorPaymentMethod) {
    setEditingId(m.id);
    const cfg = m.publicConfig ?? {};
    switch (m.provider) {
      case 'RAZORPAY':
        setDraft({
          provider: 'RAZORPAY', label: m.label, mode: m.mode, isActive: m.isActive, isDefault: m.isDefault,
          keyId: cfg.keyId ?? '', keySecret: '', webhookSecret: '',
        });
        break;
      case 'UPI_MANUAL':
        setDraft({
          provider: 'UPI_MANUAL', label: m.label, mode: m.mode, isActive: m.isActive, isDefault: m.isDefault,
          vpa: cfg.vpa ?? '', displayName: cfg.displayName ?? '',
        });
        break;
      case 'BANK_TRANSFER':
        setDraft({
          provider: 'BANK_TRANSFER', label: m.label, mode: m.mode, isActive: m.isActive, isDefault: m.isDefault,
          accountHolder: cfg.accountHolder ?? '', accountLast4: cfg.accountLast4 ?? '', ifsc: cfg.ifsc ?? '', bankName: cfg.bankName ?? '',
        });
        break;
      case 'COD':
        setDraft({
          provider: 'COD', label: m.label, mode: m.mode, isActive: m.isActive, isDefault: m.isDefault,
          notes: cfg.notes ?? '',
        });
        break;
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const payload: any = buildPayload(draft);
      if (editingId) {
        // On edit, omit credentials if blank — backend treats absence as "keep existing"
        if (draft.provider === 'RAZORPAY' && !draft.keySecret) {
          delete payload.credentials;
        }
        await api(`/api/payments/vendor/methods/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Payment method updated');
      } else {
        await api('/api/payments/vendor/methods', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Payment method added');
      }
      setDraft(null); setEditingId(null);
      load();
    } catch {} finally { setSaving(false); }
  }

  async function remove(m: VendorPaymentMethod) {
    if (!confirm(`Delete "${m.label}"? This cannot be undone.`)) return;
    try {
      await api(`/api/payments/vendor/methods/${m.id}`, { method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch {}
  }

  async function test(m: VendorPaymentMethod) {
    setTestingId(m.id);
    try {
      const res = await api<{ ok: boolean; message: string }>(`/api/payments/vendor/methods/${m.id}/test`, { method: 'POST' });
      toast[res.ok ? 'success' : 'error'](res.message || (res.ok ? 'OK' : 'Failed'));
      load();
    } catch {} finally { setTestingId(null); }
  }

  async function toggleActive(m: VendorPaymentMethod) {
    try {
      await api(`/api/payments/vendor/methods/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      load();
    } catch {}
  }

  async function setDefault(m: VendorPaymentMethod) {
    try {
      await api(`/api/payments/vendor/methods/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isDefault: true }),
      });
      load();
    } catch {}
  }

  return (
    <div>
      <PageHeader
        title="Payment methods"
        subtitle="Configure how customers pay your shop. Credentials are encrypted at rest and never leave the server."
        actions={
          !draft && (
            <div className="flex flex-wrap gap-2">
              {(['RAZORPAY', 'UPI_MANUAL', 'BANK_TRANSFER', 'COD'] as Provider[]).map((p) => (
                <button key={p} onClick={() => startCreate(p)} className="btn-secondary !px-3 !py-2 text-xs">
                  + {PROVIDER_LABEL[p]}
                </button>
              ))}
            </div>
          )
        }
      />

      {draft && (
        <Card className="p-5 mb-6">
          <h2 className="font-semibold text-ink-900 mb-1">
            {editingId ? 'Edit ' : 'Add '}{PROVIDER_LABEL[draft.provider]}
          </h2>
          <p className="text-xs text-ink-500 mb-4">{providerHelp(draft.provider)}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Label (shown to customers)" required>
              <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value } as Draft)} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder={PROVIDER_LABEL[draft.provider]} />
            </Field>
            <Field label="Mode">
              <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as Mode } as Draft)} className="w-full rounded-md border border-line px-3 py-2 text-sm">
                <option value="TEST">Test</option>
                <option value="LIVE">Live</option>
              </select>
            </Field>

            {draft.provider === 'RAZORPAY' && (
              <>
                <Field label="Key ID" required><input value={draft.keyId} onChange={(e) => setDraft({ ...draft, keyId: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="rzp_test_…" /></Field>
                <Field label={editingId ? 'Key Secret (leave blank to keep)' : 'Key Secret'} required={!editingId}>
                  <input type="password" value={draft.keySecret} onChange={(e) => setDraft({ ...draft, keySecret: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" autoComplete="new-password" />
                </Field>
                <Field label="Webhook Secret (optional)">
                  <input type="password" value={draft.webhookSecret} onChange={(e) => setDraft({ ...draft, webhookSecret: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" autoComplete="new-password" />
                </Field>
              </>
            )}
            {draft.provider === 'UPI_MANUAL' && (
              <>
                <Field label="UPI VPA" required><input value={draft.vpa} onChange={(e) => setDraft({ ...draft, vpa: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="shop@upi" /></Field>
                <Field label="Display name" required><input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="Beneficiary name" /></Field>
              </>
            )}
            {draft.provider === 'BANK_TRANSFER' && (
              <>
                <Field label="Account holder" required><input value={draft.accountHolder} onChange={(e) => setDraft({ ...draft, accountHolder: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" /></Field>
                <Field label="Last 4 of account #" required><input value={draft.accountLast4} maxLength={4} onChange={(e) => setDraft({ ...draft, accountLast4: e.target.value.replace(/\D/g, '') })} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="1234" /></Field>
                <Field label="IFSC (optional)"><input value={draft.ifsc} onChange={(e) => setDraft({ ...draft, ifsc: e.target.value.toUpperCase() })} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="HDFC0001234" /></Field>
                <Field label="Bank name (optional)"><input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" /></Field>
              </>
            )}
            {draft.provider === 'COD' && (
              <Field label="Customer note (optional)"><input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="e.g. Exact change appreciated" /></Field>
            )}

            <div className="md:col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked } as Draft)} /> Active</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked } as Draft)} /> Default at checkout</label>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={save} disabled={saving || !draft.label} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setDraft(null); setEditingId(null); }} className="btn-secondary !px-4 !py-2 text-sm">Cancel</button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-surface border border-line rounded-md animate-pulse" />)}</div>
      ) : methods.length === 0 ? (
        <Card className="p-10 text-center text-ink-700">
          No payment methods yet. Add one to start accepting payments — your shop will fall back to the platform Razorpay until then.
        </Card>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <p className="font-semibold text-ink-900">{m.label}</p>
                    <StatusPill tone="neutral">{PROVIDER_LABEL[m.provider]}</StatusPill>
                    <StatusPill tone={m.mode === 'LIVE' ? 'success' : 'warn'}>{m.mode}</StatusPill>
                    {m.isDefault && <StatusPill tone="info">Default</StatusPill>}
                    {!m.isActive && <StatusPill tone="danger">Inactive</StatusPill>}
                  </div>
                  <p className="text-xs text-ink-700 mt-1 font-mono">{summarizePublic(m)}</p>
                  <div className="mt-2 text-[11px] text-ink-500 flex flex-wrap gap-3">
                    {m.hasCredentials && <span>🔒 credentials encrypted</span>}
                    {m.lastVerifiedAt && (
                      <span className={m.verifyStatus === 'ok' ? 'text-emerald-700' : 'text-red-600'}>
                        Last test: {m.verifyStatus === 'ok' ? 'OK' : m.verifyStatus} · {new Date(m.lastVerifiedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-auto">
                  <button onClick={() => test(m)} disabled={testingId === m.id} className="btn-secondary !px-3 !py-2 text-xs disabled:opacity-50">
                    {testingId === m.id ? 'Testing…' : 'Test'}
                  </button>
                  {!m.isDefault && <button onClick={() => setDefault(m)} className="btn-secondary !px-3 !py-2 text-xs">Set default</button>}
                  <button onClick={() => toggleActive(m)} className="btn-secondary !px-3 !py-2 text-xs">{m.isActive ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => startEdit(m)} className="btn-secondary !px-3 !py-2 text-xs">Edit</button>
                  <button onClick={() => remove(m)} className="text-xs px-3 py-2 rounded-pill bg-red-50 text-danger border border-red-100">Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function summarizePublic(m: VendorPaymentMethod): string {
  const c = m.publicConfig ?? {};
  switch (m.provider) {
    case 'RAZORPAY':      return c.keyId ? `keyId: ${c.keyId}` : 'No public config';
    case 'UPI_MANUAL':    return c.vpa ? `${c.vpa} · ${c.displayName ?? ''}` : 'No public config';
    case 'BANK_TRANSFER': return [c.bankName, c.ifsc, c.accountLast4 ? `••${c.accountLast4}` : null].filter(Boolean).join(' · ') || 'No public config';
    case 'COD':           return c.notes || 'Cash on delivery';
  }
}

function providerHelp(p: Provider): string {
  switch (p) {
    case 'RAZORPAY':      return 'Customers pay online via your own Razorpay account. Funds settle directly to your bank as configured in Razorpay.';
    case 'UPI_MANUAL':    return 'Customers send a UPI payment to your VPA after placing the order. You confirm receipt before shipping.';
    case 'BANK_TRANSFER': return 'Customers transfer to your bank account. Only the last 4 digits are stored — never paste full account numbers.';
    case 'COD':           return 'Customers pay in cash on delivery. No setup needed.';
  }
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide font-semibold text-ink-700">{label}{required && <span className="text-danger ml-0.5">*</span>}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
