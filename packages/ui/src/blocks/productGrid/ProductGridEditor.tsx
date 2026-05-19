'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ProductGridSettings } from './ProductGrid';
import type { EditorContext } from '../types';

interface VendorSection {
  id: string;
  name: string;
  slug: string;
}

export function ProductGridEditor({
  settings: s,
  onChange,
}: {
  settings: ProductGridSettings;
  onChange: (next: ProductGridSettings) => void;
  ctx: EditorContext;
}) {
  const [sections, setSections] = useState<VendorSection[]>([]);

  useEffect(() => {
    api<VendorSection[]>('/api/vendors/me/sections', { silent: true })
      .then(setSections)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <Field label="Heading">
        <input
          className="input-field"
          value={s.heading}
          maxLength={200}
          onChange={(e) => onChange({ ...s, heading: e.target.value })}
        />
      </Field>

      <Field label="Source">
        <select
          className="input-field"
          value={s.source}
          onChange={(e) => onChange({ ...s, source: e.target.value as ProductGridSettings['source'] })}
        >
          <option value="all">All my products</option>
          <option value="section">From a section</option>
          <option value="manual">Pick products by ID</option>
        </select>
      </Field>

      {s.source === 'section' && (
        <Field label="Section">
          <select
            className="input-field"
            value={s.sectionId}
            onChange={(e) => onChange({ ...s, sectionId: e.target.value })}
          >
            <option value="">— Select a section —</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {s.source === 'manual' && (
        <Field label="Product IDs (comma-separated)">
          <textarea
            className="input-field"
            rows={3}
            value={s.productIds.join(',')}
            onChange={(e) =>
              onChange({
                ...s,
                productIds: e.target.value
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .slice(0, 48),
              })
            }
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Columns">
          <select
            className="input-field"
            value={s.columns}
            onChange={(e) => onChange({ ...s, columns: Number(e.target.value) as ProductGridSettings['columns'] })}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </Field>
        <Field label="Max products">
          <input
            type="number"
            min={1}
            max={48}
            className="input-field"
            value={s.limit}
            onChange={(e) =>
              onChange({ ...s, limit: Math.min(48, Math.max(1, Number(e.target.value) || 12)) })
            }
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
