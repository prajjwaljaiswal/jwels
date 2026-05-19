'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { PageHeader, Card } from '@/components/dashboard/DashboardShell';

interface Section {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export default function VendorSectionsPage() {
  const [rows, setRows] = useState<Section[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api<Section[]>('/api/vendors/me/sections');
      setRows(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await api<Section>('/api/vendors/me/sections', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), position: rows.length }),
      });
      setRows((r) => [...r, created]);
      setName('');
      toast.success('Section added');
    } catch {} finally { setSaving(false); }
  }

  async function rename(id: string, newName: string) {
    const old = rows.find((r) => r.id === id);
    if (!old || old.name === newName) return;
    try {
      const updated = await api<Section>(`/api/vendors/me/sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }),
      });
      setRows((r) => r.map((s) => (s.id === id ? updated : s)));
      toast.success('Renamed');
    } catch {}
  }

  async function remove(id: string) {
    if (!confirm('Delete this section? Listings in it will become uncategorised.')) return;
    try {
      await api(`/api/vendors/me/sections/${id}`, { method: 'DELETE' });
      setRows((r) => r.filter((s) => s.id !== id));
      toast.success('Deleted');
    } catch {}
  }

  return (
    <div>
      <PageHeader
        title="Shop sections"
        subtitle="Group your listings into browsable sections like Necklaces, Earrings, or New arrivals."
      />

      <Card className="max-w-2xl">
        <form onSubmit={add} className="p-5 border-b border-line flex gap-2">
          <input className="input-field flex-1" placeholder="New section name (e.g. Bridal collection)"
            value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <button disabled={saving || !name.trim()} className="btn-primary">
            {saving ? 'Adding…' : 'Add section'}
          </button>
        </form>

        {loading ? (
          <div className="p-5 text-sm text-ink-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-ink-700 font-semibold">No sections yet</p>
            <p className="text-xs text-ink-500 mt-1">Add your first to start grouping listings.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((s) => (
              <SectionRow key={s.id} section={s} onRename={rename} onDelete={remove} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SectionRow({
  section, onRename, onDelete,
}: {
  section: Section;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  return (
    <li className="p-4 flex items-center gap-3">
      {editing ? (
        <input
          className="input-field flex-1"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { setEditing(false); onRename(section.id, name.trim() || section.name); if (!name.trim()) setName(section.name); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(section.name); setEditing(false); } }}
          maxLength={40}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-ink-900 truncate">{section.name}</p>
          <p className="text-xs text-ink-500 font-mono truncate">/{section.slug}</p>
        </button>
      )}
      <button type="button" onClick={() => onDelete(section.id)}
        className="h-9 w-9 rounded-md hover:bg-red-50 hover:text-danger flex items-center justify-center text-ink-500"
        aria-label="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </li>
  );
}
