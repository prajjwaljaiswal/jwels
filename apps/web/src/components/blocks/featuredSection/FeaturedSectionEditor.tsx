'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { FeaturedSectionSettings } from './FeaturedSection';

interface VendorSection {
  id: string;
  name: string;
}

export function FeaturedSectionEditor({
  settings: s,
  onChange,
}: {
  settings: FeaturedSectionSettings;
  onChange: (next: FeaturedSectionSettings) => void;
  ctx: any;
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
      <Field label="Section">
        <select
          className="input-field"
          value={s.sectionId}
          onChange={(e) => onChange({ ...s, sectionId: e.target.value })}
        >
          <option value="">— Select a section —</option>
          {sections.map((sec) => (
            <option key={sec.id} value={sec.id}>{sec.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Layout">
          <select
            className="input-field"
            value={s.layout}
            onChange={(e) => onChange({ ...s, layout: e.target.value as FeaturedSectionSettings['layout'] })}
          >
            <option value="grid">Grid</option>
            <option value="carousel">Carousel</option>
          </select>
        </Field>
        <Field label="Max products">
          <input
            type="number"
            min={1}
            max={24}
            className="input-field"
            value={s.limit}
            onChange={(e) => onChange({ ...s, limit: Math.min(24, Math.max(1, Number(e.target.value) || 8)) })}
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
