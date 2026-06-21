import { Role } from '@prisma/client';
import { prisma } from './prisma';

// Single source of truth for "who can see / act on a support ticket", shared by
// the REST routes AND the socket.io join handler so a client can never join a
// room (or read a thread) it isn't entitled to.
//
// Topology recap (see schema.prisma):
//   vendorId set  → customer↔vendor thread, handled by that vendor (+ admins)
//   vendorId null → platform queue, handled by admins only
// The *requester* is always ticket.creator. The *agent side* is the owning
// vendor (when vendorId set) and/or any admin.

export interface Actor {
  id: string;
  role: Role;
}

export interface TicketAccess {
  /** May read the ticket + send messages on it. */
  canAccess: boolean;
  /** Is the ticket creator (the requester side). */
  isRequester: boolean;
  /** Is an admin. */
  isAdmin: boolean;
  /** Is the vendor that owns this ticket (vendorId match). */
  isOwningVendor: boolean;
  /** May see internal notes (admin, or the owning vendor). Never the requester. */
  canSeeInternalNotes: boolean;
}

interface TicketShape {
  creatorId: string;
  vendorId: string | null;
}

/** Resolve the caller's vendor id, but only bother for VENDOR-role users. */
export async function resolveVendorId(user: Actor): Promise<string | null> {
  if (user.role !== Role.VENDOR) return null;
  const v = await prisma.vendor.findUnique({ where: { userId: user.id }, select: { id: true } });
  return v?.id ?? null;
}

/**
 * Pure evaluation given an already-loaded ticket and the caller's vendor id
 * (pass null for non-vendors). Use this from routes that already fetched the
 * ticket to avoid a second query.
 */
export function evaluateTicketAccess(
  user: Actor,
  ticket: TicketShape,
  userVendorId: string | null,
): TicketAccess {
  const isAdmin = user.role === Role.ADMIN;
  const isRequester = ticket.creatorId === user.id;
  const isOwningVendor = !!ticket.vendorId && ticket.vendorId === userVendorId;
  const canAccess = isAdmin || isRequester || isOwningVendor;
  // Internal notes are staff-only: admins on any ticket, the owning vendor on
  // its own customer↔vendor threads. The requester (even a vendor requester on a
  // vendor↔platform ticket) never sees internal notes.
  const canSeeInternalNotes = isAdmin || isOwningVendor;
  return { canAccess, isRequester, isAdmin, isOwningVendor, canSeeInternalNotes };
}

/**
 * Convenience: load the ticket and evaluate access in one call. Used by the
 * socket join handler (which has no pre-loaded ticket). Returns null ticket if
 * the ticket doesn't exist.
 */
export async function canAccessTicket(
  user: Actor,
  ticketId: string,
): Promise<{ access: TicketAccess; ticket: (TicketShape & { id: string }) | null }> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, creatorId: true, vendorId: true },
  });
  if (!ticket) {
    return {
      access: {
        canAccess: false,
        isRequester: false,
        isAdmin: false,
        isOwningVendor: false,
        canSeeInternalNotes: false,
      },
      ticket: null,
    };
  }
  const userVendorId = await resolveVendorId(user);
  return { access: evaluateTicketAccess(user, ticket, userVendorId), ticket };
}
