'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card, StatusPill } from '@/components/dashboard/DashboardShell';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

interface MyProposal {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  approvalStatus: 'APPROVED' | 'PROPOSED' | 'REJECTED';
  rejectionNote: string | null;
  createdAt: string;
  parent: { id: string; name: string; slug: string } | null;
}

export default function VendorCategoriesPage() {
  const [roots, setRoots] = useState<Category[]>([]);
  const [mine, setMine] = useState<MyProposal[]>([]);
  const [form, setForm] = useState({ name: '', parentId: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [cats, ours] = await Promise.all([
        api<Category[]>('/api/categories', { auth: false }),
        api<MyProposal[]>('/api/vendors/me/categories'),
      ]);
      setRoots(cats.filter((c) => !c.parentId));
      setMine(ours);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Name must be at least 2 characters');
    setBusy(true);
    try {
      await api('/api/vendors/me/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          parentId: form.parentId || undefined,
          description: form.description.trim() || undefined,
        }),
      });
      toast.success('Sent for review — admin will respond within 24–48 hours');
      setForm({ name: '', parentId: '', description: '' });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Propose a category"
        subtitle="Suggest a new category for the marketplace. An admin reviews each proposal before it goes live."
      />

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <Card className="p-6">
          <h2 className="font-semibold text-ink-900 mb-4">New proposal</h2>
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">
                Category name <span className="text-danger">*</span>
              </span>
              <input className="input-field" required minLength={2} maxLength={60}
                placeholder="e.g. Antique Polki Necklaces"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">
                Parent category <span className="text-ink-500 font-normal normal-case">(optional — leave blank for top level)</span>
              </span>
              <select className="input-field"
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                <option value="">— Top level —</option>
                {roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <span className="block text-xs text-ink-500 mt-1">
                Most proposals should be sub-categories under an existing parent.
              </span>
            </label>

            <label className="block">
              <span className="block text-xs uppercase tracking-wide font-semibold text-ink-700 mb-1.5">
                Why this category?
              </span>
              <textarea className="input-field h-24 py-2" maxLength={500}
                placeholder="A short note for the admin — what products will go here and why it doesn't fit existing categories."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>

            <button disabled={busy} className="btn-primary">
              {busy ? 'Sending…' : 'Submit for review'}
            </button>
          </form>
        </Card>

        <Card className="p-6 h-fit">
          <h3 className="font-semibold text-ink-900 mb-3">How it works</h3>
          <ol className="space-y-3 text-sm text-ink-700">
            {[
              'Submit a category name and an optional parent.',
              'Admin reviews to avoid duplicates and keep the taxonomy clean.',
              'Once approved, you and other sellers can list products under it.',
              'If rejected, you\'ll see a note explaining why.',
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="font-display text-2xl text-ink-900 mb-4">Your proposals</h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 bg-surface border border-line rounded-md animate-pulse" />)}
          </div>
        ) : mine.length === 0 ? (
          <Card className="p-10 text-center text-ink-700">You haven't proposed any categories yet.</Card>
        ) : (
          <div className="space-y-3">
            {mine.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-ink-900">{c.name}</h3>
                      <code className="text-xs text-ink-500 font-mono">{c.slug}</code>
                      <StatusPill tone={c.approvalStatus === 'APPROVED' ? 'success' : c.approvalStatus === 'REJECTED' ? 'danger' : 'warn'}>
                        {c.approvalStatus}
                      </StatusPill>
                    </div>
                    <p className="text-sm text-ink-700 mt-1">
                      Parent: {c.parent ? <span className="font-semibold">{c.parent.name}</span> : <span className="text-ink-500">— top level —</span>}
                      {' · proposed '}
                      {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                    {c.description && <p className="text-sm text-ink-700 mt-1.5">{c.description}</p>}
                    {c.approvalStatus === 'REJECTED' && c.rejectionNote && (
                      <p className="text-sm text-danger mt-1.5">Rejected: {c.rejectionNote}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
