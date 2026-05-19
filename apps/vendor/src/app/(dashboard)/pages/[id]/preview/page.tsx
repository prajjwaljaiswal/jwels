'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { BlockRenderer } from '@/components/blocks/BlockRenderer';
import type { Block } from '@/components/blocks/types';

interface PageData {
  id: string;
  vendorId: string;
  title: string;
  draftBlocks: Block[];
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PageData | null>(null);

  async function load() {
    try {
      const d = await api<PageData>(`/api/vendor-pages/me/${id}`, { silent: true });
      setData(d);
    } catch {}
  }

  useEffect(() => {
    load();
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'jm:refresh') load();
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [id]);

  if (!data) {
    return <div className="p-8 text-sm text-ink-600">Loading preview…</div>;
  }
  const blocks = Array.isArray(data.draftBlocks) ? data.draftBlocks : [];

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-yellow-50 text-yellow-900 text-xs px-4 py-1.5 border-b border-yellow-200">
        Draft preview — changes are not visible to customers until you publish.
      </div>
      {blocks.length === 0 ? (
        <div className="p-12 text-center text-ink-500">
          <p>No blocks yet. Add a block to start building your page.</p>
        </div>
      ) : (
        <BlockRenderer
          blocks={blocks}
          ctx={{ scope: 'vendor', vendorId: data.vendorId }}
          showHidden
          hiddenWrapper={(node) => (
            <div className="relative">
              <span className="absolute top-2 right-2 z-10 rounded bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 font-medium border border-amber-200">
                Hidden — not visible to shoppers
              </span>
              <div style={{ opacity: 0.4 }}>{node}</div>
            </div>
          )}
        />
      )}
    </div>
  );
}
