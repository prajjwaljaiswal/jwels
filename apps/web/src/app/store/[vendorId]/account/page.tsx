'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useVendor } from '@/lib/vendor-context';

interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  createdAt: string;
}

export default function VendorAccountPage() {
  const router = useRouter();
  const { vendor, theme, storeKey } = useVendor();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    const next = `/store/${storeKey}/account`;
    if (!t) { router.replace(`/auth/login?next=${encodeURIComponent(next)}`); return; }
    api<Me>('/api/auth/me', { silent: true })
      .then((u) => {
        setMe(u);
        setName(u.name || '');
        setPhone(u.phone || '');
      })
      .catch(() => router.replace(`/auth/login?next=${encodeURIComponent(next)}`))
      .finally(() => setLoading(false));
  }, [router, vendor.id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api<Me>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone: phone || null }),
      });
      setMe(updated);
      toast.success('Profile updated');
    } catch {} finally { setSavingProfile(false); }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    if (newPassword.length < 6)        { toast.error('New password must be at least 6 characters'); return; }
    setSavingPass(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success('Password changed');
    } catch {} finally { setSavingPass(false); }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="h-8 w-40 rounded animate-pulse bg-canvas" />
        <div className="mt-6 space-y-4">
          {[0,1].map((i) => <div key={i} className="h-40 rounded-md animate-pulse bg-surface border border-line" />)}
        </div>
      </div>
    );
  }
  if (!me) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <nav className="text-xs text-ink-500 mb-1">
        <Link href={`/store/${storeKey}`} className="hover:opacity-70" style={{ color: theme }}>{vendor.shopName}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-900">My account</span>
      </nav>

      <div>
        <h1 className="text-3xl text-ink-900">My account</h1>
        <p className="text-sm text-ink-500 mt-1">Member since {new Date(me.createdAt).toLocaleDateString()}</p>
      </div>

      <section className="bg-surface border border-line rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Profile details</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Email">
            <input className="input-field bg-canvas" value={me.email} disabled />
          </Field>
          <Field label="Full name">
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Field label="Phone">
            <input className="input-field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
          </Field>
          <button disabled={savingProfile}
            className="px-5 py-2.5 rounded-pill text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: theme }}
          >
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="bg-surface border border-line rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Change password</h2>
        <form onSubmit={savePassword} className="space-y-4">
          <Field label="Current password">
            <input className="input-field" type="password" autoComplete="current-password"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </Field>
          <Field label="New password">
            <input className="input-field" type="password" autoComplete="new-password" minLength={6}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm new password">
            <input className="input-field" type="password" autoComplete="new-password" minLength={6}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </Field>
          <button disabled={savingPass}
            className="px-5 py-2.5 rounded-pill text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: theme }}
          >
            {savingPass ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="bg-surface border border-line rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-3">Shortcuts</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={`/store/${storeKey}/orders`}
            className="px-4 py-2 rounded-pill border font-semibold text-sm transition-colors hover:bg-canvas"
            style={{ borderColor: theme, color: theme }}
          >
            Orders from {vendor.shopName}
          </Link>
          <Link href={`/store/${storeKey}`}
            className="px-4 py-2 rounded-pill border font-semibold text-sm transition-colors hover:bg-canvas"
            style={{ borderColor: theme, color: theme }}
          >
            Continue shopping
          </Link>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
