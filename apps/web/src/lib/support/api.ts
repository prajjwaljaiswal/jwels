import { api } from '../api';
import type { SupportTicketDTO, SupportMessageDTO, CreateTicketInput, TicketCategory } from './types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// Customer-facing subset of the support API.
export const supportApi = {
  listMyTickets: (f: { status?: string; category?: TicketCategory } = {}) =>
    api<SupportTicketDTO[]>(`/api/support/tickets${qs({ status: f.status, category: f.category })}`),
  createTicket: (body: CreateTicketInput) =>
    api<SupportTicketDTO>('/api/support/tickets', { method: 'POST', body: JSON.stringify(body) }),
  getTicket: (id: string) => api<SupportTicketDTO>(`/api/support/tickets/${id}`),
  getMessages: (id: string) => api<SupportMessageDTO[]>(`/api/support/tickets/${id}/messages`),
  sendMessage: (id: string, body: { body: string; attachments?: string[] }) =>
    api<SupportMessageDTO>(`/api/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
  markRead: (id: string) => api<{ ok: boolean }>(`/api/support/tickets/${id}/read`, { method: 'PATCH' }),
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
};
