import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import type { Role } from '@prisma/client';
import { verifyToken } from './jwt';
import { canAccessTicket } from './support-access';
import { logger } from './logger';

// Realtime layer for the support module.
//
// Cardinal rule: REST is the single source of truth. Every canonical write
// (a message, a read receipt, a status change) is persisted by an HTTP route;
// this socket layer only *notifies* the relevant room afterwards and carries
// ephemeral signals (typing/presence) that are never persisted. A dropped
// socket therefore never loses data — the page reloads history over REST.
//
// Rooms (per ticket):
//   ticket:<id>        — all participants (requester + agents). Public messages.
//   ticket:<id>:staff  — agents only (admins + owning vendor). Internal notes.

interface SocketUser {
  id: string;
  role: Role;
}

let io: Server | null = null;

const publicRoom = (ticketId: string) => `ticket:${ticketId}`;
const staffRoom = (ticketId: string) => `ticket:${ticketId}:staff`;

export function initRealtime(httpServer: HttpServer): Server {
  if (io) return io;

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      // Allow ALL origins. The JWT handshake check in io.use() below is the real
      // auth boundary, so origin is not used for security. The callback reflects
      // whatever Origin the caller sends (required to keep credentials working —
      // a bare '*' is rejected by browsers when credentials are enabled).
      origin: (_origin, cb) => cb(null, true),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Also accept connections with no Origin header (native/mobile clients).
    allowEIO3: true,
  });

  // Connection-level JWT auth (runs once at handshake, re-runs on reconnect
  // because the client provides `auth` as a function that re-reads the token).
  io.use((socket, next) => {
    const raw =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.headers?.authorization?.startsWith('Bearer ')
        ? socket.handshake.headers.authorization.slice(7)
        : undefined);
    const payload = raw ? verifyToken(raw) : null;
    if (!payload) return next(new Error('unauthorized'));
    (socket.data as { user?: SocketUser }).user = { id: payload.userId, role: payload.role };
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user: SocketUser }).user;

    // Per-user room for account-wide notifications (delivered even when the user
    // isn't viewing the ticket). Admins also join a shared room for platform-queue
    // tickets that aren't assigned to a specific agent.
    socket.join(`user:${user.id}`);
    if (user.role === 'ADMIN') socket.join('admins');

    // Join a ticket room after an authorization check (never trust the client's
    // claimed ticketId). On reconnect the client re-emits this.
    socket.on('ticket:subscribe', async (ticketId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (typeof ticketId !== 'string') return ack?.(false);
        const { access } = await canAccessTicket(user, ticketId);
        if (!access.canAccess) return ack?.(false);

        await socket.join(publicRoom(ticketId));
        if (access.canSeeInternalNotes) await socket.join(staffRoom(ticketId));

        // Room-scoped presence (who's currently viewing this ticket).
        socket.to(publicRoom(ticketId)).emit('presence:join', { ticketId, userId: user.id, role: user.role });
        ack?.(true);
      } catch (e) {
        logger.warn({ err: (e as Error)?.message }, 'ticket:subscribe failed');
        ack?.(false);
      }
    });

    socket.on('ticket:unsubscribe', (ticketId: unknown) => {
      if (typeof ticketId !== 'string') return;
      socket.leave(publicRoom(ticketId));
      socket.leave(staffRoom(ticketId));
      socket.to(publicRoom(ticketId)).emit('presence:leave', { ticketId, userId: user.id });
    });

    // Ephemeral typing indicator — rebroadcast to others in the room only.
    // Gated on actual room membership (which required an authorized subscribe).
    socket.on('typing', (data: unknown) => {
      const d = data as { ticketId?: string; isTyping?: boolean };
      if (!d?.ticketId || !socket.rooms.has(publicRoom(d.ticketId))) return;
      socket.to(publicRoom(d.ticketId)).emit('typing', {
        ticketId: d.ticketId,
        userId: user.id,
        role: user.role,
        isTyping: !!d.isTyping,
      });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('ticket:') && !room.endsWith(':staff')) {
          const ticketId = room.slice('ticket:'.length);
          socket.to(room).emit('presence:leave', { ticketId, userId: user.id });
        }
      }
    });
  });

  logger.info('[realtime] socket.io initialized at /socket.io');
  return io;
}

export function getIO(): Server | null {
  return io;
}

/**
 * Notify a ticket room of a new message. Internal notes go ONLY to the staff
 * sub-room so a customer's socket never receives them. No-op if realtime isn't
 * initialized (e.g. in tests) — REST already persisted the message.
 */
export function emitNewMessage(ticketId: string, message: unknown, internal: boolean) {
  if (!io) return;
  const room = internal ? staffRoom(ticketId) : publicRoom(ticketId);
  io.to(room).emit('message:new', { ticketId, message });
}

/** Notify a room that one side has read the thread (drives read receipts). */
export function emitTicketRead(ticketId: string, payload: { side: 'requester' | 'agent'; readAt: string }) {
  if (!io) return;
  io.to(publicRoom(ticketId)).emit('ticket:read', { ticketId, ...payload });
}

/** Notify a room that ticket metadata changed (status/priority/assignment). */
export function emitTicketUpdate(ticketId: string, ticket: unknown) {
  if (!io) return;
  io.to(publicRoom(ticketId)).emit('ticket:update', { ticketId, ticket });
}

export interface NotifyPayload {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  fromName: string;
  preview: string;
}

/** Account-wide notification to a specific user (any device/tab they have open). */
export function emitNotifyToUser(userId: string, payload: NotifyPayload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notify:message', payload);
}

/** Account-wide notification to all connected admins (platform queue). */
export function emitNotifyToAdmins(payload: NotifyPayload) {
  if (!io) return;
  io.to('admins').emit('notify:message', payload);
}
