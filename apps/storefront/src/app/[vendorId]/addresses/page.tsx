'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { addressApi, type Address, type AddressInput } from '@/lib/addresses';
import { AddressForm } from '@/components/AddressForm';

export default function VendorAddressesPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const router = useRouter();
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace(`/login?next=/${vendorId}/addresses`); return; }
    addressApi.list()
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router, vendorId]);

  async function onCreate(input: AddressInput) {
    const created = await addressApi.create(input);
    setItems((cur) => {
      const cleared = created.isDefault ? cur.map((a) => ({ ...a, isDefault: false })) : cur;
      return [created, ...cleared];
    });
    setAdding(false);
    toast.success('Address added');
  }

  async function onUpdate(id: string, input: AddressInput) {
    const updated = await addressApi.update(id, input);
    setItems((cur) =>
      cur.map((a) => (a.id === id ? updated : updated.isDefault ? { ...a, isDefault: false } : a))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    );
    setEditing(null);
    toast.success('Address updated');
  }

  async function onMakeDefault(id: string) {
    await addressApi.setDefault(id);
    setItems((cur) =>
      cur.map((a) => ({ ...a, isDefault: a.id === id }))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    );
    toast.success('Default updated');
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this address?')) return;
    await addressApi.remove(id);
    setItems((cur) => cur.filter((a) => a.id !== id));
    toast.success('Address removed');
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="font-display text-3xl">Saved addresses</h1>
        {!adding && (
          <button className="btn-primary" onClick={() => { setAdding(true); setEditing(null); }}>Add new</button>
        )}
      </div>

      {adding && (
        <div className="bg-surface border border-line rounded-md p-5 mb-6">
          <h2 className="font-display text-xl mb-4">New address</h2>
          <AddressForm onSubmit={onCreate} onCancel={() => setAdding(false)} />
        </div>
      )}

      {loading ? (
        <p className="text-ink-700">Loading…</p>
      ) : items.length === 0 && !adding ? (
        <div className="text-center py-16 border border-line rounded-md bg-surface">
          <p className="font-display text-xl mb-1">No saved addresses</p>
          <p className="text-sm text-ink-700 mb-5">Add one to make checkout faster.</p>
          <button className="btn-primary" onClick={() => setAdding(true)}>Add an address</button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="bg-surface border border-line rounded-md p-5">
              {editing === a.id ? (
                <AddressForm
                  initial={a}
                  submitLabel="Update address"
                  onSubmit={(input) => onUpdate(a.id, input)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {a.label && <span className="font-semibold">{a.label}</span>}
                      {a.isDefault && (
                        <span className="text-[11px] uppercase tracking-wide bg-brand-50 text-brand-700 border border-brand-600/40 rounded-pill px-2 py-0.5">Default</span>
                      )}
                    </div>
                    <p className="text-sm">{a.name} · {a.phone}</p>
                    <p className="text-sm text-ink-700 mt-0.5">
                      {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}, {a.country}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button className="text-xs hover:underline" onClick={() => { setEditing(a.id); setAdding(false); }}>Edit</button>
                    {!a.isDefault && <button className="text-xs hover:underline" onClick={() => onMakeDefault(a.id)}>Make default</button>}
                    <button className="text-xs text-danger hover:underline" onClick={() => onDelete(a.id)}>Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
