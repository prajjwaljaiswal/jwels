'use client';
import { useEffect, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { connectSocket, getSocket } from './socket';
import { useSupportNotifications, refreshUnread, type NotifItem } from './notifications';

const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';

// App-wide for logged-in customers: socket notify:message → toast + unread store.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const add = useSupportNotifications((s) => s.add);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.localStorage.getItem(TOKEN_KEY)) return;
    const socket = getSocket();
    const onNotify = (p: Omit<NotifItem, 'at'>) => {
      add(p);
      toast(`💬 ${p.fromName}: ${p.preview}`, { duration: 6000, icon: '💬' });
    };
    socket.on('notify:message', onNotify);
    connectSocket();
    refreshUnread();
    const onFocus = () => refreshUnread();
    window.addEventListener('focus', onFocus);
    return () => {
      socket.off('notify:message', onNotify);
      window.removeEventListener('focus', onFocus);
    };
  }, [add]);
  return <>{children}</>;
}
