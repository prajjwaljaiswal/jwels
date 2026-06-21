'use client';
import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import type { SupportMessageDTO, SupportTicketDTO } from '../support/types';

export interface TicketStreamHandlers {
  onMessage?: (message: SupportMessageDTO) => void;
  onTicketUpdate?: (ticket: SupportTicketDTO) => void;
  onRead?: (payload: { side: 'requester' | 'agent'; readAt: string }) => void;
  onTyping?: (payload: { userId: string; role: string; isTyping: boolean }) => void;
  onPresence?: (payload: { userId: string; present: boolean }) => void;
}

/**
 * Subscribe to a ticket's realtime room. Joins on mount (and re-joins on every
 * reconnect, since socket.io rooms are per-connection), tears down on unmount.
 * The socket only *notifies* — callers still load history over REST; this just
 * live-appends. Returns the connection state + a typing emitter.
 */
export function useTicketStream(ticketId: string | null | undefined, handlers: TicketStreamHandlers) {
  const [connected, setConnected] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  // Keep latest handlers in a ref so changing callbacks doesn't re-subscribe.
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!ticketId) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const subscribe = () => {
      socket.emit('ticket:subscribe', ticketId, (ok: boolean) => setSubscribed(!!ok));
    };

    const onConnect = () => { setConnected(true); subscribe(); };
    const onDisconnect = () => { setConnected(false); setSubscribed(false); };
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
    const onPresenceJoin = (p: { ticketId: string; userId: string }) => {
      if (p?.ticketId === ticketId) h.current.onPresence?.({ userId: p.userId, present: true });
    };
    const onPresenceLeave = (p: { ticketId: string; userId: string }) => {
      if (p?.ticketId === ticketId) h.current.onPresence?.({ userId: p.userId, present: false });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessage);
    socket.on('ticket:update', onTicketUpdate);
    socket.on('ticket:read', onRead);
    socket.on('typing', onTyping);
    socket.on('presence:join', onPresenceJoin);
    socket.on('presence:leave', onPresenceLeave);

    if (socket.connected) { setConnected(true); subscribe(); }

    return () => {
      socket.emit('ticket:unsubscribe', ticketId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessage);
      socket.off('ticket:update', onTicketUpdate);
      socket.off('ticket:read', onRead);
      socket.off('typing', onTyping);
      socket.off('presence:join', onPresenceJoin);
      socket.off('presence:leave', onPresenceLeave);
    };
  }, [ticketId]);

  const sendTyping = (isTyping: boolean) => {
    if (!ticketId) return;
    getSocket().emit('typing', { ticketId, isTyping });
  };

  return { connected, subscribed, sendTyping };
}
