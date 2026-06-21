'use client';
import { useEffect, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { connectSocket, getSocket } from './socket';
import { useSupportNotifications, refreshUnread, type NotifItem } from './notifications';

const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';

/**
 * App-wide provider for logged-in users: opens the singleton socket and turns
 * server `notify:message` events into a toast + the unread badge store. Mount
 * once in an authenticated layout. No-op for guests (no token).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const add = useSupportNotifications((s) => s.add);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(TOKEN_KEY)) return; // only connect for logged-in users

    const socket = getSocket();
    const onNotify = (p: Omit<NotifItem, 'at'>) => {
      add(p);
      toast(`💬 ${p.fromName}: ${p.preview}`, { duration: 6000, icon: '💬' });
    };
    socket.on('notify:message', onNotify);
    connectSocket();
    refreshUnread(); // seed the badge with the real unread count on load
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      socket.off('notify:message', onNotify);
      window.removeEventListener('focus', onFocus);
    };
  }, [add]);

  return <>{children}</>;
}
