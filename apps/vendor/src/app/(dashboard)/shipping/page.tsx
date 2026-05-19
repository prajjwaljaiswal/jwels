'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';
import { useCurrency, CURRENCIES } from '@/lib/currency';

type Mode = 'TEST' | 'LIVE';

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'select';
  required?: boolean;
  helpText?: string;
  options?: { value: string; label: string }[];
  isDefault?: boolean;
}

interface CarrierManifest {
  key: string;
  displayName: string;
  logoUrl?: string;
  credentialFields: CredentialField[];
  supportsCreateShipment: boolean;
  supportsTracking: boolean;
}

interface AddressForm {
  contactName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CarrierAccount {
  id: string;
  carrier: string;
  accountLabel: string;
  mode: Mode;
  isActive: boolean;
  lastVerifiedAt: string | null;
  verifyStatus: string | null;
  defaults: Record<string, string>;
  credentials: Record<string, { hasValue: boolean; preview: string }>;
}

const EMPTY_ADDRESS: AddressForm = {
  contactName: '', phone: '', line1: '', line2: '',
  city: '', state: '', postalCode: '', country: 'IN',
};

export default function VendorShippingPage() {
  const [tab, setTab] = useState<'address' | 'accounts' | 'methods'>('address');

  return (
    <div>
      <PageHeader
        title="Shipping"
        subtitle="Pickup address, carrier accounts, and the methods customers see at checkout."
      />

      {/* Setup sequence guide */}
      <div className="mb-6 bg-brand-50 border border-brand-200 rounded-md px-4 py-3 flex flex-wrap gap-4 text-sm text-ink-700">
        <span className="font-semibold text-brand-700 shrink-0">Setup order:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
          Set your <button onClick={() => setTab('address')} className="text-brand-700 font-medium hover:underline">Pickup address</button>
        </span>
        <span className="text-ink-400">→</span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
          Add &amp; verify <button onClick={() => setTab('accounts')} className="text-brand-700 font-medium hover:underline">Carrier accounts</button>
          <span className="text-ink-400 text-xs">(optional — skip for manual dispatch)</span>
        </span>
        <span className="text-ink-400">→</span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
          Create <button onClick={() => setTab('methods')} className="text-brand-700 font-medium hover:underline">Shipping methods</button>
          <span className="text-ink-400 text-xs">(shown to customers at checkout)</span>
        </span>
      </div>

      <div className="flex gap-2 border-b border-line mb-6">
        <TabBtn active={tab === 'address'} onClick={() => setTab('address')}>Pickup address</TabBtn>
        <TabBtn active={tab === 'accounts'} onClick={() => setTab('accounts')}>Carrier accounts</TabBtn>
        <TabBtn active={tab === 'methods'} onClick={() => setTab('methods')}>Shipping methods</TabBtn>
      </div>

      {tab === 'address' && <AddressTab />}
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'methods' && <MethodsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        active ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-600 hover:text-ink-900'
      }`}
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// Pickup address
// ──────────────────────────────────────────────────────────
function AddressTab() {
  const [form, setForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<AddressForm | null>('/api/shipping/vendor/address')
      .then((a) => { if (a) setForm({ ...EMPTY_ADDRESS, ...a, line2: a.line2 ?? '' }); })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/api/shipping/vendor/address', {
        method: 'PUT',
        body: JSON.stringify({ ...form, line2: form.line2 || null }),
      });
      toast.success('Pickup address saved');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Card className="p-6"><div className="text-sm text-ink-500">Loading…</div></Card>;

  return (
    <Card className="p-6">
      <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Contact name" required>
          <input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required />
        </Field>
        <Field label="Phone" required>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </Field>
        <Field label="Address line 1" required className="md:col-span-2">
          <input className="input" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required />
        </Field>
        <Field label="Address line 2" className="md:col-span-2">
          <input className="input" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
        </Field>
        <Field label="City" required>
          <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        </Field>
        <Field label="State" required>
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required />
        </Field>
        <Field label="Postal code" required>
          <input className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} required />
        </Field>
        <Field label="Country (ISO-2)" required>
          <input className="input" maxLength={2} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} required />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save address'}</button>
        </div>
      </form>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────
// Carrier accounts
// ──────────────────────────────────────────────────────────
function AccountsTab() {
  const [carriers, setCarriers] = useState<CarrierManifest[]>([]);
  const [accounts, setAccounts] = useState<CarrierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CarrierAccount | null>(null);
  const [creatingFor, setCreatingFor] = useState<CarrierManifest | null>(null);

  async function reload() {
    const [cs, accs] = await Promise.all([
      api<CarrierManifest[]>('/api/shipping/carriers', { auth: false }),
      api<CarrierAccount[]>('/api/shipping/vendor/accounts'),
    ]);
    setCarriers(cs);
    setAccounts(accs);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function verify(id: string) {
    const t = toast.loading('Verifying…');
    try {
      const result = await api<{ ok: boolean; message?: string; account: CarrierAccount }>(
        `/api/shipping/vendor/accounts/${id}/verify`,
        { method: 'POST' },
      );
      toast.dismiss(t);
      if (result.ok) toast.success(result.message || 'Verified');
      else toast.error(result.message || 'Verification failed');
      setAccounts((prev) => prev.map((a) => (a.id === id ? result.account : a)));
    } catch {
      toast.dismiss(t);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this carrier account? Methods using it will be unlinked.')) return;
    await api(`/api/shipping/vendor/accounts/${id}`, { method: 'DELETE' });
    toast.success('Deleted');
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  if (loading) return <Card className="p-6"><div className="text-sm text-ink-500">Loading…</div></Card>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Add a carrier</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {carriers.map((c) => (
            <button
              key={c.key}
              onClick={() => setCreatingFor(c)}
              className="border border-line rounded-md p-4 text-left hover:border-brand-500 hover:bg-brand-50 transition"
            >
              <div className="text-sm font-semibold text-ink-900">{c.displayName}</div>
              <div className="text-xs text-ink-500 mt-0.5">{c.key}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-base font-semibold mb-3">Your carrier accounts</h3>
        {accounts.length === 0 ? (
          <div className="text-sm text-ink-500">No carrier accounts yet.</div>
        ) : (
          <div className="divide-y divide-line">
            {accounts.map((a) => (
              <div key={a.id} className="py-3 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-ink-900">{a.accountLabel}</div>
                  <div className="text-xs text-ink-500">
                    {a.carrier} · {a.mode}
                    {' · '}
                    {a.lastVerifiedAt
                      ? <span className="text-emerald-700">Verified ✓</span>
                      : a.verifyStatus
                        ? <span className="text-red-700">{a.verifyStatus}</span>
                        : <span className="text-amber-700">Unverified</span>}
                  </div>
                </div>
                <button onClick={() => verify(a.id)} className="btn-secondary text-xs">Verify</button>
                <button onClick={() => setEditing(a)} className="btn-secondary text-xs">Edit</button>
                <button onClick={() => remove(a.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {creatingFor && (
        <AccountModal
          mode="create"
          carrier={creatingFor}
          onClose={() => setCreatingFor(null)}
          onSaved={async () => { setCreatingFor(null); await reload(); }}
        />
      )}
      {editing && (
        <AccountModal
          mode="edit"
          carrier={carriers.find((c) => c.key === editing.carrier)!}
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Modal: create/edit account
// ──────────────────────────────────────────────────────────
function AccountModal({
  mode, carrier, account, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  carrier: CarrierManifest;
  account?: CarrierAccount;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [label, setLabel] = useState(account?.accountLabel ?? '');
  const [carrierMode, setCarrierMode] = useState<Mode>(account?.mode ?? 'TEST');
  const [fields, setFields] = useState<Record<string, string>>(() => {
    // For edit: prefill non-secret defaults; secrets shown as masked, blank input means "keep prior"
    const init: Record<string, string> = {};
    if (account) {
      for (const f of carrier.credentialFields) {
        if (f.isDefault) init[f.key] = String(account.defaults?.[f.key] ?? '');
        else init[f.key] = '';
      }
    } else {
      for (const f of carrier.credentialFields) init[f.key] = '';
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Drop empty values so PATCH preserves existing secrets.
      const fieldsPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v !== '') fieldsPayload[k] = v;
      }
      if (mode === 'create') {
        await api('/api/shipping/vendor/accounts', {
          method: 'POST',
          body: JSON.stringify({
            carrier: carrier.key,
            accountLabel: label,
            mode: carrierMode,
            fields: fieldsPayload,
          }),
        });
        toast.success('Carrier account added');
      } else if (account) {
        await api(`/api/shipping/vendor/accounts/${account.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            accountLabel: label,
            mode: carrierMode,
            fields: fieldsPayload,
          }),
        });
        toast.success('Updated');
      }
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save carrier account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? `Add ${carrier.displayName}` : `Edit ${carrier.displayName}`}
          </h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900">✕</button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          <Field label="Account label" required>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. My main account" />
          </Field>
          <Field label="Mode" required>
            <select className="input" value={carrierMode} onChange={(e) => setCarrierMode(e.target.value as Mode)}>
              <option value="TEST">TEST (sandbox)</option>
              <option value="LIVE">LIVE (production)</option>
            </select>
          </Field>

          <div className="border-t border-line pt-4 space-y-4">
            {carrier.credentialFields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required && mode === 'create'}>
                {f.type === 'select' ? (
                  <select className="input" value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}>
                    <option value="">— Select —</option>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    className="input"
                    type={f.type === 'secret' ? 'password' : 'text'}
                    value={fields[f.key] ?? ''}
                    placeholder={
                      mode === 'edit' && f.type === 'secret' && account?.credentials?.[f.key]?.hasValue
                        ? `Leave blank to keep ${account.credentials[f.key].preview}`
                        : ''
                    }
                    onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                    autoComplete="off"
                  />
                )}
                {f.helpText && <div className="text-xs text-ink-500 mt-1">{f.helpText}</div>}
              </Field>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : mode === 'create' ? 'Add account' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Shipping methods
// ──────────────────────────────────────────────────────────
type ServiceType = 'STANDARD' | 'EXPRESS' | 'OVERNIGHT' | 'SAME_DAY';
type RateMode = 'FLAT' | 'LIVE';

interface ShippingMethod {
  id: string;
  name: string;
  carrier: string;
  serviceType: ServiceType;
  rateMode: RateMode;
  carrierAccountId: string | null;
  baseRate: string | number;
  perItemRate: string | number | null;
  freeAbove: string | number | null;
  etaMinDays: number;
  etaMaxDays: number;
  zones: string[];
  isActive: boolean;
}

const EMPTY_METHOD = {
  id: '',
  name: '',
  carrier: 'CUSTOM',
  serviceType: 'STANDARD' as ServiceType,
  rateMode: 'FLAT' as RateMode,
  carrierAccountId: null as string | null,
  baseRate: 0,
  perItemRate: null as number | null,
  freeAbove: null as number | null,
  etaMinDays: 3,
  etaMaxDays: 7,
  zones: [] as string[],
  isActive: true,
};

function MethodsTab() {
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code].symbol;
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [accounts, setAccounts] = useState<CarrierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ShippingMethod | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    const [m, a] = await Promise.all([
      api<ShippingMethod[]>('/api/shipping/vendor/methods'),
      api<CarrierAccount[]>('/api/shipping/vendor/accounts'),
    ]);
    setMethods(m);
    setAccounts(a);
  }

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  async function toggleActive(m: ShippingMethod) {
    const updated = await api<ShippingMethod>(`/api/shipping/vendor/methods/${m.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    setMethods((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
  }

  async function remove(id: string) {
    if (!confirm('Delete this shipping method?')) return;
    await api(`/api/shipping/vendor/methods/${id}`, { method: 'DELETE' });
    setMethods((prev) => prev.filter((x) => x.id !== id));
    toast.success('Deleted');
  }

  if (loading) return <Card className="p-6"><div className="text-sm text-ink-500">Loading…</div></Card>;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">Your shipping methods</h3>
            <p className="text-xs text-ink-500 mt-0.5">Customers pick from these at checkout, grouped by your shop.</p>
          </div>
          <button onClick={() => setCreating(true)} className="btn-primary text-sm">+ New method</button>
        </div>

        {methods.length === 0 ? (
          <div className="text-sm text-ink-500">No shipping methods yet — add Standard and Express to get started.</div>
        ) : (
          <div className="divide-y divide-line">
            {methods.map((m) => (
              <div key={m.id} className="py-3 flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium text-ink-900">
                    {m.name} <span className="text-xs text-ink-500">· {m.serviceType}</span>
                    {!m.isActive && <span className="ml-2 text-xs text-amber-700">(inactive)</span>}
                  </div>
                  <div className="text-xs text-ink-500">
                    {m.carrier} · {m.rateMode === 'FLAT'
                      ? `Flat ${currencySymbol}${Number(m.baseRate).toFixed(2)}${m.perItemRate ? ` + ${currencySymbol}${Number(m.perItemRate).toFixed(2)}/item` : ''}${m.freeAbove ? ` · free above ${currencySymbol}${Number(m.freeAbove).toFixed(2)}` : ''}`
                      : 'Live rates'}
                    {' · '}{m.etaMinDays}–{m.etaMaxDays} days
                    {m.zones?.length > 0 && !m.zones.includes('*') ? ` · ${m.zones.length} zone(s)` : ''}
                  </div>
                </div>
                <button onClick={() => toggleActive(m)} className="btn-secondary text-xs">
                  {m.isActive ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => setEditing(m)} className="btn-secondary text-xs">Edit</button>
                <button onClick={() => remove(m.id)} className="text-xs text-red-600 hover:underline">Delete</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {(creating || editing) && (
        <MethodModal
          method={editing ?? null}
          accounts={accounts}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={async () => { setCreating(false); setEditing(null); await reload(); }}
        />
      )}
    </div>
  );
}

function MethodModal({
  method, accounts, onClose, onSaved,
}: {
  method: ShippingMethod | null;
  accounts: CarrierAccount[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { code } = useCurrency();
  const currencySymbol = CURRENCIES[code].symbol;
  const isEdit = !!method;
  const [form, setForm] = useState({
    name: method?.name ?? '',
    carrier: method?.carrier ?? 'CUSTOM',
    serviceType: (method?.serviceType ?? 'STANDARD') as ServiceType,
    rateMode: (method?.rateMode ?? 'FLAT') as RateMode,
    carrierAccountId: method?.carrierAccountId ?? '',
    baseRate: method ? Number(method.baseRate) : 0,
    perItemRate: method?.perItemRate != null ? Number(method.perItemRate) : ('' as '' | number),
    freeAbove: method?.freeAbove != null ? Number(method.freeAbove) : ('' as '' | number),
    etaMinDays: method?.etaMinDays ?? 3,
    etaMaxDays: method?.etaMaxDays ?? 7,
    zonesText: (method?.zones ?? []).join(', '),
    isActive: method?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  // When LIVE: carrier follows the selected account's carrier.
  const verifiedAccounts = accounts.filter((a) => !!a.lastVerifiedAt);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    // Client-side guard: ETA range
    if (Number(form.etaMaxDays) < Number(form.etaMinDays)) {
      toast.error('ETA max days must be ≥ min days');
      return;
    }
    // Client-side guard: LIVE needs a carrier account selected
    if (form.rateMode === 'LIVE' && !form.carrierAccountId) {
      toast.error('Select a verified carrier account for live rates');
      return;
    }

    setSaving(true);
    try {
      let carrier = form.carrier;
      if (form.rateMode === 'LIVE') {
        const acct = accounts.find((a) => a.id === form.carrierAccountId);
        if (!acct) throw new Error('Carrier account not found');
        carrier = acct.carrier;
      }
      const zones = form.zonesText.split(',').map((z) => z.trim()).filter(Boolean);
      const payload = {
        name: form.name,
        carrier,
        serviceType: form.serviceType,
        rateMode: form.rateMode,
        carrierAccountId: form.rateMode === 'LIVE' ? (form.carrierAccountId || null) : null,
        baseRate: Number(form.baseRate) || 0,
        perItemRate: form.perItemRate === '' ? null : Number(form.perItemRate),
        freeAbove: form.freeAbove === '' ? null : Number(form.freeAbove),
        etaMinDays: Number(form.etaMinDays),
        etaMaxDays: Number(form.etaMaxDays),
        zones: zones.length ? zones : ['*'],
        isActive: form.isActive,
      };
      if (isEdit && method) {
        await api(`/api/shipping/vendor/methods/${method.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast.success('Updated');
      } else {
        await api('/api/shipping/vendor/methods', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Method added');
      }
      await onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save shipping method');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{isEdit ? 'Edit shipping method' : 'New shipping method'}</h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900">✕</button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" required>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard / Express" required />
            </Field>
            <Field label="Service type">
              <select className="input" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value as ServiceType })}>
                <option value="STANDARD">Standard</option>
                <option value="EXPRESS">Express</option>
                <option value="OVERNIGHT">Overnight</option>
                <option value="SAME_DAY">Same day</option>
              </select>
            </Field>
          </div>

          <Field label="Rate mode">
            <select className="input" value={form.rateMode} onChange={(e) => setForm({ ...form, rateMode: e.target.value as RateMode })}>
              <option value="FLAT">Flat (you set the price)</option>
              <option value="LIVE">Live (calculated by carrier)</option>
            </select>
          </Field>

          {form.rateMode === 'LIVE' ? (
            <Field label="Carrier account" required>
              {verifiedAccounts.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  No verified carrier accounts. Add one in the Carrier accounts tab and click Verify before using live rates.
                </div>
              ) : (
                <select className="input" value={form.carrierAccountId} onChange={(e) => setForm({ ...form, carrierAccountId: e.target.value })} required>
                  <option value="">— Select —</option>
                  {verifiedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.carrier} · {a.accountLabel} ({a.mode})</option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <>
              <Field label="Carrier">
                <input className="input" value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value.toUpperCase() })} placeholder="CUSTOM, FEDEX, INDIA_POST…" />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label={`Base rate (${currencySymbol})`} required>
                  <input className="input" type="number" step="0.01" min="0" value={form.baseRate} onChange={(e) => setForm({ ...form, baseRate: Number(e.target.value) })} required />
                </Field>
                <Field label={`Per item add-on (${currencySymbol})`}>
                  <input className="input" type="number" step="0.01" min="0" value={form.perItemRate} onChange={(e) => setForm({ ...form, perItemRate: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="optional" />
                </Field>
                <Field label={`Free above (${currencySymbol})`}>
                  <input className="input" type="number" step="0.01" min="0" value={form.freeAbove} onChange={(e) => setForm({ ...form, freeAbove: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="optional" />
                </Field>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="ETA min (days)" required>
              <input className="input" type="number" min="0" value={form.etaMinDays} onChange={(e) => setForm({ ...form, etaMinDays: Number(e.target.value) })} required />
            </Field>
            <Field label="ETA max (days)" required>
              <input className="input" type="number" min="0" value={form.etaMaxDays} onChange={(e) => setForm({ ...form, etaMaxDays: Number(e.target.value) })} required />
            </Field>
          </div>

          <Field label="Zones">
            <input className="input" value={form.zonesText} onChange={(e) => setForm({ ...form, zonesText: e.target.value })} placeholder="* (all) or comma-separated state codes e.g. DL, MH, KA" />
            <div className="text-xs text-ink-500 mt-1">Leave blank or use * to ship anywhere. Match by destination state code.</div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active (visible at checkout)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : isEdit ? 'Save' : 'Add method'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Shared field wrapper
// ──────────────────────────────────────────────────────────
function Field({
  label, required, children, className,
}: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ink-700 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
