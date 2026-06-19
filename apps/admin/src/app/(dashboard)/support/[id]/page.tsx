'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { SupportThread } from '@/components/support/SupportThread';
import { useMe, usePermissions } from '@/lib/permissions';
import { supportApi } from '@/lib/support/api';
import { CATEGORY_LABELS, TICKET_PRIORITIES, TICKET_STATUSES, STATUS_LABELS } from '@/lib/support/types';
import type { SupportTicketDTO, TicketStatus, TicketPriority } from '@/lib/support/types';

export default function AdminTicketPage() {
  const params = useParams();
  const id = String(params.id);
  const { me } = useMe();
  const { has } = usePermissions();
  const canManage = has('SUPPORT_MANAGE');
  const [ticket, setTicket] = useState<SupportTicketDTO | null>(null);
  const [saving, setSaving] = useState(false);

  async function patch(body: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null }) {
    setSaving(true);
    try {
      const updated = await supportApi.adminPatch(id, body);
      setTicket(updated);
      toast.success('Updated');
    } catch (e: any) {
      toast.error(e?.message || 'Could not update');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/support" className="text-sm text-ink-500 hover:text-brand-700">← Back to queue</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <SupportThread ticketId={id} role="admin" onTicketLoaded={setTicket} />

        <aside className="space-y-4">
          <div className="rounded-md bg-surface border border-line shadow-card p-4">
            <h3 className="text-sm font-semibold text-ink-900 mb-3">Details</h3>
            {ticket ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Ticket</dt><dd className="text-ink-800">{ticket.ticketNumber}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">From</dt><dd className="text-ink-800 truncate">{ticket.creatorName || '—'} ({ticket.creatorRole.toLowerCase()})</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Routed to</dt><dd className="text-ink-800 truncate">{ticket.vendorName || 'Platform'}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Category</dt><dd className="text-ink-800">{CATEGORY_LABELS[ticket.category]}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-500">Assignee</dt><dd className="text-ink-800 truncate">{ticket.assignedToName || 'Unassigned'}</dd></div>
              </dl>
            ) : <p className="text-sm text-ink-500">Loading…</p>}
          </div>

          {canManage ? (
            <div className="rounded-md bg-surface border border-line shadow-card p-4">
              <h3 className="text-sm font-semibold text-ink-900 mb-3">Manage</h3>
              <label className="block mb-3">
                <span className="block text-xs font-semibold text-ink-700 mb-1">Status</span>
                <select disabled={saving || !ticket} value={ticket?.status || 'OPEN'}
                  onChange={(e) => patch({ status: e.target.value as TicketStatus })}
                  className="w-full rounded-md border border-line px-2 h-9 text-sm">
                  {TICKET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </label>
              <label className="block mb-3">
                <span className="block text-xs font-semibold text-ink-700 mb-1">Priority</span>
                <select disabled={saving || !ticket} value={ticket?.priority || 'NORMAL'}
                  onChange={(e) => patch({ priority: e.target.value as TicketPriority })}
                  className="w-full rounded-md border border-line px-2 h-9 text-sm">
                  {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <button disabled={saving || !me || ticket?.assignedToId === me?.id}
                  onClick={() => patch({ assignedToId: me!.id })}
                  className="flex-1 h-9 rounded-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
                  Assign to me
                </button>
                <button disabled={saving || !ticket?.assignedToId}
                  onClick={() => patch({ assignedToId: null })}
                  className="h-9 px-3 rounded-md border border-line text-sm hover:bg-canvas disabled:opacity-50">
                  Unassign
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-surface border border-line shadow-card p-4 text-sm text-ink-500">
              You have read-only access (needs SUPPORT_MANAGE to reply or change status).
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
