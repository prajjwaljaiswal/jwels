import { io, type Socket } from 'socket.io-client';

// Singleton socket.io client (local copy for the self-contained customer app).
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = process.env.NEXT_PUBLIC_TOKEN_KEY || 'token';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API, {
    path: '/socket.io',
    autoConnect: false,
    // Polling first, then upgrade to WebSocket if the proxy allows it — connects
    // reliably even when nginx doesn't forward the WebSocket upgrade.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: (cb: (data: { token: string | null }) => void) => {
      const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
      cb({ token });
    },
  });
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket && socket.connected) socket.disconnect();
}
