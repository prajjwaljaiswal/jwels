'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { connectSocket, getSocket } from './socket';

const Ctx = createContext<{ connected: boolean }>({ connected: false });

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    connectSocket();
    // Don't disconnect on unmount — shared singleton used app-wide by NotificationsProvider.
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  return <Ctx.Provider value={{ connected }}>{children}</Ctx.Provider>;
}

export function useRealtime() {
  return useContext(Ctx);
}
