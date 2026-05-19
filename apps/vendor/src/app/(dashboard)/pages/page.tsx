'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

interface VendorPageRow {
  id: string;
  slug: string;
  title: string;
  isHomepage: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export default function VendorPagesIndex() {
  const [rows, setRows] = useState<VendorPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isHomepage, setIsHomepage] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<VendorPageRow[]>('/api/vendor-pages/me');
      setRows(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function autoSlug(t: string) {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api<VendorPageRow>('/api/vendor-pages/me', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim() || autoSlug(title),
          isHomepage,
        }),
      });
      setRows((r) => (isHomepage ? r.map((p) => ({ ...p, isHomepage: false })) : r).concat(created));
      setTitle('');
      setSlug('');
      setIsHomepage(false);
      setShowCreate(false);
      toast.success('Page created');
    } catch {
    } finally {
      setCreating(false);
    }
  }

  async function setHome(id: string) {
    try {
      await api(`/api/vendor-pages/me/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHomepage: true }),
      });
      setRows((r) => r.map((p) => ({ ...p, isHomepage: p.id === id })));
      toast.success('Homepage updated');
    } catch {}
  }

  async function remove(id: string) {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    try {
      await api(`/api/vendor-pages/me/${id}`, { method: 'DELETE' });
      setRows((r) => r.filter((p) => p.id !== id));
      toast.success('Deleted');
    } catch {}
  }

  return (
    <div>
      <PageHeader
        title="Storefront pages"
        subtitle="Build your homepage and additional pages from blocks. Customers see your published pages on your shop."
        actions={
          <button className="btn-primary" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? 'Cancel' : 'New page'}
          </button>
        }
      />

      {showCreate && (
        <Card className="mb-6 max-w-2xl">
          <form onSubmit={create} className="p-5 space-y-3">
            <label className="block">
              <span className="block text-xs font-medium text-ink-700 mb-1">Title</span>
              <input
                className="input-field"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slug || slug === autoSlug(title)) setSlug(autoSlug(e.target.value));
                }}
                placeholder="About us"
                maxLength={120}
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-ink-700 mb-1">URL slug</span>
              <input
                className="input-field"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="about-us"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={64}
                required
              />
              <span className="text-xs text-ink-500">Lowercase letters, numbers, and dashes only.</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isHomepage} onChange={(e) => setIsHomepage(e.target.checked)} />
              Set as homepage
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={creating || !title.trim()} className="btn-primary">
                {creating ? 'Creating…' : 'Create page'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-ink-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-ink-600">No pages yet. Create your first one to start customizing your storefront.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-line text-ink-700">
                <th className="p-3">Title</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Status</th>
                <th className="p-3">Updated</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line hover:bg-canvas">
                  <td className="p-3">
                    <Link href={`/pages/${p.id}`} className="text-brand-700 hover:underline font-medium">
                      {p.title}
                    </Link>
                    {p.isHomepage && <span className="ml-2 text-xs bg-brand-100 text-brand-800 px-2 py-0.5 rounded">Homepage</span>}
                  </td>
                  <td className="p-3 text-ink-600">/{p.slug}</td>
                  <td className="p-3">
                    {p.isPublished ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Published</span>
                    ) : (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Draft</span>
                    )}
                  </td>
                  <td className="p-3 text-ink-600">{new Date(p.updatedAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right space-x-2">
                    {!p.isHomepage && (
                      <button onClick={() => setHome(p.id)} className="text-xs text-ink-700 hover:text-brand-700">
                        Set as homepage
                      </button>
                    )}
                    <Link href={`/pages/${p.id}`} className="text-xs text-ink-700 hover:text-brand-700">
                      Edit
                    </Link>
                    {!p.isHomepage && (
                      <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:text-red-700">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
