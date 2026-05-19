'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

interface ReturnPolicy {
  id: string;
  name: string;
  accepted: boolean;
  days: number;
  buyerPaysReturn: boolean;
  notes: string | null;
}

const EMPTY = { name: '', accepted: true, days: 14, buyerPaysReturn: true, notes: '' };

export default function VendorReturnPoliciesPage() {
  const [rows, setRows] = useState<ReturnPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows(await api<ReturnPolicy[]>('/api/vendors/me/return-policies')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function startNew() { setEditId('new'); setForm(EMPTY); }
  function startEdit(r: ReturnPolicy) {
    setEditId(r.id);
    setForm({ name: r.name, accepted: r.accepted, days: r.days, buyerPaysReturn: r.buyerPaysReturn, notes: r.notes ?? '' });
  }
  function cancel() { setEditId(null); setForm(EMPTY); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), notes: form.notes.trim() || undefined };
      if (editId === 'new') {
        const created = await api<ReturnPolicy>('/api/vendors/me/return-policies', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setRows((r) => [...r, created]);
      } else if (editId) {
        const updated = await api<ReturnPolicy>(`/api/vendors/me/return-policies/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setRows((r) => r.map((p) => (p.id === editId ? updated : p)));
      }
      cancel();
      toast.success('Policy saved');
    } catch {} finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this policy? Listings using it will fall back to no policy.')) return;
    try {
      await api(`/api/vendors/me/return-policies/${id}`, { method: 'DELETE' });
      setRows((r) => r.filter((p) => p.id !== id));
      toast.success('Deleted');
    } catch {}
  }

  return (
    <div>
      <PageHeader
        title="Return policies"
        subtitle="Reusable return rules. Attach a policy to each listing in the editor."
        actions={
          editId === null && (
            <button type="button" onClick={startNew} className="btn-primary text-sm">+ New policy</button>
          )
        }
      />

      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl">
        <div className="space-y-3">
          {loading ? (
            <Card className="p-5 text-sm text-ink-500">Loading…</Card>
          ) : rows.length === 0 && editId === null ? (
            <Card className="p-10 text-center">
              <p className="text-sm text-ink-700 font-semibold">No policies yet</p>
              <p className="text-xs text-ink-500 mt-1">Create one to attach to your listings.</p>
            </Card>
          ) : (
            rows.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 truncate">{p.name}</p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {p.accepted ? `${p.days}-day returns` : 'No returns accepted'}
                      {p.accepted && (p.buyerPaysReturn ? ' · buyer pays return shipping' : ' · seller pays return shipping')}
                    </p>
                    {p.notes && <p className="text-xs text-ink-700 mt-2 leading-relaxed">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => startEdit(p)}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-800 px-2 py-1">Edit</button>
                    <button type="button" onClick={() => remove(p.id)}
                      className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500" aria-label="Delete">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {editId !== null && (
          <Card>
            <form onSubmit={save} className="p-5 space-y-4">
              <h2 className="font-semibold text-ink-900">{editId === 'new' ? 'New policy' : 'Edit policy'}</h2>

              <Field label="Name">
                <input className="input-field" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
              </Field>

              <Toggle
                label="Accept returns"
                checked={form.accepted}
                onChange={(v) => setForm({ ...form, accepted: v })}
              />

              {form.accepted && (
                <>
                  <Field label="Return window (days)">
                    <input className="input-field max-w-xs" type="number" min={0} max={365}
                      value={form.days}
                      onChange={(e) => setForm({ ...form, days: Number(e.target.value) || 0 })} />
                  </Field>
                  <Toggle
                    label="Buyer pays return shipping"
                    checked={form.buyerPaysReturn}
                    onChange={(v) => setForm({ ...form, buyerPaysReturn: v })}
                  />
                </>
              )}

              <Field label="Notes (optional)" hint={`${form.notes.length}/500`}>
                <textarea className="input-field min-h-[80px] resize-y" maxLength={500}
                  placeholder="Anything buyers should know — e.g. items must be unworn, original packaging required."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={cancel} className="btn-secondary flex-1">Cancel</button>
                <button disabled={saving || !form.name.trim()} className="btn-primary flex-1">
                  {saving ? 'Saving…' : 'Save policy'}
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-700">{label}</span>
        {hint && <span className="text-[11px] text-ink-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 p-3 rounded-md border border-line bg-canvas hover:bg-surface text-left transition">
      <span className={['h-5 w-9 rounded-full transition-colors shrink-0 relative', checked ? 'bg-brand-600' : 'bg-ink-300'].join(' ')}>
        <span className={['absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
      </span>
      <span className="text-sm text-ink-900">{label}</span>
    </button>
  );
}
