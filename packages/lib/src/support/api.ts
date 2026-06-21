import { api } from '../api';
import type {
  SupportTicketDTO,
  SupportMessageDTO,
  CannedReplyDTO,
  CreateTicketInput,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== false) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface TicketFilters {
  status?: string; // comma-separated
  category?: TicketCategory;
  unread?: boolean;
  scope?: 'platform' | 'vendor';
  vendorId?: string;
  assignedToId?: string;
  flagged?: boolean;
  q?: string;
}

export const supportApi = {
  // ── Requester (any authenticated user) ──────────────────────────────────
  listMyTickets: (f: TicketFilters = {}) =>
    api<SupportTicketDTO[]>(`/api/support/tickets${qs({ status: f.status, category: f.category })}`),
  createTicket: (body: CreateTicketInput) =>
    api<SupportTicketDTO>('/api/support/tickets', { method: 'POST', body: JSON.stringify(body) }),
  getTicket: (id: string) => api<SupportTicketDTO>(`/api/support/tickets/${id}`),
  getMessages: (id: string) => api<SupportMessageDTO[]>(`/api/support/tickets/${id}/messages`),
  sendMessage: (id: string, body: { body: string; attachments?: string[]; isInternalNote?: boolean }) =>
    api<SupportMessageDTO>(`/api/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  markRead: (id: string) => api<{ ok: boolean }>(`/api/support/tickets/${id}/read`, { method: 'PATCH' }),

  // Upload an attachment (image / PDF, 10MB). Returns the hosted URL.
  uploadAttachment: async (file: File): Promise<{ url: string; kind: string; name: string }> => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API}/api/support/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Upload failed');
    return res.json();
  },

  // ── Vendor ──────────────────────────────────────────────────────────────
  vendorInbox: (f: TicketFilters = {}) =>
    api<SupportTicketDTO[]>(`/api/support/vendor/tickets${qs({ status: f.status, category: f.category, unread: f.unread })}`),
  vendorPatch: (id: string, body: { status?: TicketStatus; priority?: TicketPriority }) =>
    api<SupportTicketDTO>(`/api/support/vendor/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminQueue: (f: TicketFilters = {}) =>
    api<SupportTicketDTO[]>(
      `/api/support/admin/tickets${qs({
        status: f.status, category: f.category, scope: f.scope, vendorId: f.vendorId,
        assignedToId: f.assignedToId, flagged: f.flagged, q: f.q,
      })}`,
    ),
  adminStats: () => api<{ byStatus: Record<string, number>; unassignedOpen: number }>('/api/support/admin/stats'),
  adminPatch: (
    id: string,
    body: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: string | null; tags?: string[] },
  ) => api<SupportTicketDTO>(`/api/support/admin/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // ── Agent shared (vendor or admin) ────────────────────────────────────────
  listCanned: () => api<CannedReplyDTO[]>('/api/support/canned'),
  createCanned: (body: { title: string; body: string; category?: TicketCategory | null; isShared?: boolean }) =>
    api<CannedReplyDTO>('/api/support/canned', { method: 'POST', body: JSON.stringify(body) }),
  updateCanned: (id: string, body: Partial<{ title: string; body: string; category: TicketCategory | null; isShared: boolean }>) =>
    api<CannedReplyDTO>(`/api/support/canned/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCanned: (id: string) => api<void>(`/api/support/canned/${id}`, { method: 'DELETE' }),
  aiDraft: (id: string) =>
    api<{ draft: string; source: 'ai' | 'fallback'; available: boolean }>(
      `/api/support/tickets/${id}/ai-draft`, { method: 'POST' },
    ),
};
