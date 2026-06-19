'use client';
import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import type { SupportMessageDTO, SupportTicketDTO } from '../support/types';

export interface TicketStreamHandlers {
  onMessage?: (message: SupportMessageDTO) => void;
  onTicketUpdate?: (ticket: SupportTicketDTO) => void;
  onRead?: (payload: { side: 'requester' | 'agent'; readAt: string }) => void;
  onTyping?: (payload: { userId: string; role: string; isTyping: boolean }) => void;
}

export function useTicketStream(ticketId: string | null | undefined, handlers: TicketStreamHandlers) {
  const [connected, setConnected] = useState(false);
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!ticketId) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const subscribe = () => socket.emit('ticket:subscribe', ticketId, () => {});
    const onConnect = () => { setConnected(true); subscribe(); };
    const onDisconnect = () => setConnected(false);
    const onMessage = (p: { ticketId: string; message: SupportMessageDTO }) => {
      if (p?.ticketId === ticketId) h.current.onMessage?.(p.message);
    };
    const onTicketUpdate = (p: { ticketId: string; ticket: SupportTicketDTO }) => {
      if (p?.ticketId === ticketId) h.current.onTicketUpdate?.(p.ticket);
    };
    const onRead = (p: { ticketId: string; side: 'requester' | 'agent'; readAt: string }) => {
      if (p?.ticketId === ticketId) h.current.onRead?.({ side: p.side, readAt: p.readAt });
    };
    const onTyping = (p: { ticketId: string; userId: string; role: string; isTyping: boolean }) => {
      if (p?.ticketId === ticketId) h.current.onTyping?.({ userId: p.userId, role: p.role, isTyping: p.isTyping });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('ticket:update', onTicketUpdate);
    socket.on('ticket:read', onRead);
    socket.on('typing', onTyping);
    if (socket.connected) { setConnected(true); subscribe(); }

    return () => {
      socket.emit('ticket:unsubscribe', ticketId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('ticket:update', onTicketUpdate);
      socket.off('ticket:read', onRead);
      socket.off('typing', onTyping);
    };
  }, [ticketId]);

  const sendTyping = (isTyping: boolean) => {
    if (!ticketId) return;
    getSocket().emit('typing', { ticketId, isTyping });
  };

  return { connected, sendTyping };
}
