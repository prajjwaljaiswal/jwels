'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface Me {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  createdAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
    if (!t) { router.replace('/auth/login?next=/account'); return; }
    api<Me>('/api/auth/me', { silent: true })
      .then((u) => {
        setMe(u);
        setName(u.name || '');
        setPhone(u.phone || '');
      })
      .catch(() => router.replace('/auth/login?next=/account'))
      .finally(() => setLoading(false));
  }, [router]);

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
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setSavingPass(true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed');
    } catch {} finally { setSavingPass(false); }
  }

  if (loading) return <div className="max-w-container mx-auto px-6 py-10">Loading…</div>;
  if (!me) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-900">My account</h1>
        <p className="text-sm text-ink-500 mt-1">Member since {new Date(me.createdAt).toLocaleDateString()}</p>
      </div>

      {/* Profile */}
      <section className="bg-surface border border-line rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Profile details</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Email</span>
            <input className="input-field bg-canvas" value={me.email} disabled />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Full name</span>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Phone</span>
            <input className="input-field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
          </label>
          <button disabled={savingProfile} className="btn-primary">
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="bg-surface border border-line rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-4">Change password</h2>
        <form onSubmit={savePassword} className="space-y-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Current password</span>
            <input className="input-field" type="password" autoComplete="current-password"
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">New password</span>
            <input className="input-field" type="password" autoComplete="new-password" minLength={6}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">Confirm new password</span>
            <input className="input-field" type="password" autoComplete="new-password" minLength={6}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
          <button disabled={savingPass} className="btn-primary">
            {savingPass ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      {/* Quick links */}
      <section className="bg-surface border border-line rounded-md p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink-900 mb-3">Shortcuts</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/orders" className="btn-secondary">My orders</Link>
          {me.role === 'VENDOR' && <Link href="/vendor" className="btn-secondary">Vendor dashboard</Link>}
          {me.role === 'ADMIN' && <Link href="/admin" className="btn-secondary">Admin</Link>}
        </div>
      </section>
    </div>
  );
}
