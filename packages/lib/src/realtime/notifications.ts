import { create } from 'zustand';
import { api } from '../api';

// Global in-app notification store, populated by NotificationsProvider from
// socket `notify:message` events. Read anywhere (e.g. the NotificationBell)
// without a context — zustand is module-global.

export interface NotifItem {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  fromName: string;
  preview: string;
  at: number;
}

interface NotifState {
  unread: number;
  items: NotifItem[];
  add: (n: Omit<NotifItem, 'at'>) => void;
  setUnread: (n: number) => void;
  clearUnread: () => void;
}

export const useSupportNotifications = create<NotifState>((set) => ({
  unread: 0,
  items: [],
  add: (n) =>
    set((s) => ({
      unread: s.unread + 1,
      items: [{ ...n, at: typeof Date !== 'undefined' ? Date.now() : 0 }, ...s.items].slice(0, 20),
    })),
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  clearUnread: () => set({ unread: 0 }),
}));

// Sync the badge to the server's true unread count (on mount, on focus, on open).
export async function refreshUnread(): Promise<void> {
  try {
    const r = await api<{ unread: number }>('/api/support/unread-count', { silent: true });
    useSupportNotifications.getState().setUnread(r.unread);
  } catch {
    // ignore — keep the current optimistic count
  }
}
