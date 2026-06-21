'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { connectSocket, getSocket } from './socket';

interface RealtimeCtx {
  connected: boolean;
}

const Ctx = createContext<RealtimeCtx>({ connected: false });

/**
 * Mount inside an *authenticated* layout (not the root layout) so the socket
 * connects only where a logged-in user exists. Connecting is best-effort — if
 * the handshake fails (no/expired token) the UI still works over REST.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    connectSocket();
    // NOTE: do NOT disconnect on unmount — the socket is a shared singleton used
    // app-wide by NotificationsProvider. Tearing it down here would kill realtime
    // notifications everywhere the moment you leave a support page.
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
