import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  Role,
  Permission,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SenderRole,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, requirePermission } from '../middleware/auth';
import { evaluateTicketAccess, resolveVendorId, type Actor } from '../lib/support-access';
import {
  emitNewMessage, emitTicketRead, emitTicketUpdate, emitNotifyToUser, emitNotifyToAdmins,
} from '../lib/realtime';
import { sendSupportMessageEmail, sendSupportTicketReceivedEmail } from '../lib/email';
import { draftSupportReply, aiAvailable } from '../lib/ai';
import { sendPushToUser, vapidPublicKey } from '../lib/push';
import { uploadBuffer } from '../lib/cloudinary';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getVendor(userId: string) {
  return prisma.vendor.findUnique({ where: { userId }, select: { id: true } });
}

function senderFromRole(role: Role): SenderRole {
  return role === Role.ADMIN ? SenderRole.ADMIN : role === Role.VENDOR ? SenderRole.VENDOR : SenderRole.CUSTOMER;
}

// App-generated human-friendly ticket number "TKT/2026/000123", counter per year
// kept in the Setting table (mirrors the invoice-number scheme).
async function nextTicketNumber(now: Date): Promise<string> {
  const year = now.getFullYear();
  const key = `support_ticket_counter_${year}`;
  const n = await prisma.$transaction(async (tx) => {
    const s = await tx.setting.findUnique({ where: { key } });
    const next = (s ? parseInt(s.value, 10) || 0 : 0) + 1;
    await tx.setting.upsert({ where: { key }, create: { key, value: String(next) }, update: { value: String(next) } });
    return next;
  });
  return `TKT/${year}/${String(n).padStart(6, '0')}`;
}

// Lightweight PII / off-platform guardrail. Flags (doesn't block) messages that
// look like an attempt to move the conversation off-platform.
const RX_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const RX_PHONE = /(?:\+91[\s-]?)?[6-9]\d{9}\b|\b\d{10}\b/;
const RX_URL = /\b(?:https?:\/\/|www\.)\S+/i;
function detectPii(body: string): string | null {
  const hits: string[] = [];
  if (RX_EMAIL.test(body)) hits.push('email');
  if (RX_PHONE.test(body)) hits.push('phone');
  if (RX_URL.test(body)) hits.push('link');
  return hits.length ? `Possible contact info shared (${hits.join(', ')})` : null;
}

const ORIGINS = {
  web: () => process.env.WEB_ORIGIN || 'http://localhost:3000',
  vendor: () => process.env.VENDOR_ORIGIN || 'http://localhost:3001',
  admin: () => process.env.ADMIN_ORIGIN || 'http://localhost:3002',
};
function ticketLink(kind: 'web' | 'vendor' | 'admin', id: string): string {
  if (kind === 'web') return `${ORIGINS.web()}/account/support/${id}`;
  if (kind === 'vendor') return `${ORIGINS.vendor()}/support/${id}`;
  return `${ORIGINS.admin()}/support/${id}`;
}

type ViewerSide = 'requester' | 'agent';

function serializeMessage(m: any) {
  return {
    id: m.id,
    ticketId: m.ticketId,
    authorId: m.authorId,
    authorRole: m.authorRole,
    authorName: m.authorName,
    body: m.body,
    attachments: m.attachments ?? [],
    isInternalNote: m.isInternalNote,
    flagged: m.flagged,
    flagReason: m.flagReason ?? null,
    systemEvent: m.systemEvent ?? null,
    readAt: m.readAt ?? null,
    createdAt: m.createdAt,
  };
}

function serializeTicket(t: any, side: ViewerSide) {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    creatorId: t.creatorId,
    creatorRole: t.creatorRole,
    creatorName: t.creator?.name ?? null,
    vendorId: t.vendorId,
    vendorName: t.vendor?.shopName ?? null,
    orderId: t.orderId,
    orderItemId: t.orderItemId,
    productId: t.productId,
    productName: t.product?.name ?? null,
    productImage: t.product?.images?.[0] ?? null,
    assignedToId: t.assignedToId,
    assignedToName: t.assignedTo?.name ?? null,
    unread: side === 'requester' ? t.customerUnread : t.agentUnread,
    lastMessageAt: t.lastMessageAt,
    firstResponseAt: t.firstResponseAt ?? null,
    resolvedAt: t.resolvedAt ?? null,
    closedAt: t.closedAt ?? null,
    tags: t.tags ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// Valid status transitions (enforced for vendors; admins may set any).
const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.PENDING, TicketStatus.AWAITING_CUSTOMER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  PENDING: [TicketStatus.OPEN, TicketStatus.AWAITING_CUSTOMER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  AWAITING_CUSTOMER: [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  RESOLVED: [TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.CLOSED],
  CLOSED: [TicketStatus.OPEN],
};

function statusStamps(next: TicketStatus): Prisma.SupportTicketUpdateInput {
  if (next === TicketStatus.RESOLVED) return { resolvedAt: new Date() };
  if (next === TicketStatus.CLOSED) return { closedAt: new Date() };
  return {};
}

const TICKET_INCLUDE = {
  creator: { select: { name: true } },
  vendor: { select: { shopName: true } },
  product: { select: { name: true, images: true } },
  assignedTo: { select: { name: true } },
} satisfies Prisma.SupportTicketInclude;

// ─────────────────────────────────────────────────────────────────────────────
// Attachments — shared upload endpoint (images + PDF, 10MB). Returns a URL the
// composer then includes in the message body's `attachments` array.
// ─────────────────────────────────────────────────────────────────────────────

router.post('/attachments', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const isImage = file.mimetype.startsWith('image/');
    const isPdf = file.mimetype === 'application/pdf';
    if (!isImage && !isPdf) return res.status(400).json({ error: 'Only images and PDF files are accepted' });
    const url = await uploadBuffer(file.buffer, `support/${req.user!.id}`, 'auto');
    res.status(201).json({ url, kind: isPdf ? 'pdf' : 'image', name: file.originalname });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Create a ticket (any authenticated user)
// ─────────────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  category: z.nativeEnum(TicketCategory).default(TicketCategory.OTHER),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.NORMAL),
  vendorId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  orderItemId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(5000),
  attachments: z.array(z.string().url()).max(6).optional(),
});

router.post('/tickets', requireAuth, async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = parsed.data;
    const creatorRole = senderFromRole(req.user!.role);

    // A customer cannot file a ticket "as a vendor" against themselves, etc.
    // Validate optional context links so we don't leak or attach foreign rows.
    if (data.vendorId) {
      const v = await prisma.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true } });
      if (!v) return res.status(400).json({ error: 'Vendor not found' });
    }
    if (data.orderId) {
      const o = await prisma.order.findUnique({ where: { id: data.orderId }, select: { customerId: true } });
      if (!o) return res.status(400).json({ error: 'Order not found' });
      if (req.user!.role === Role.CUSTOMER && o.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'That order is not yours' });
      }
    }
    if (data.productId) {
      const p = await prisma.product.findUnique({ where: { id: data.productId }, select: { id: true } });
      if (!p) return res.status(400).json({ error: 'Product not found' });
    }

    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true, email: true } });
    const now = new Date();
    const ticketNumber = await nextTicketNumber(now);
    const piiReason = detectPii(data.body);

    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          ticketNumber,
          subject: data.subject,
          category: data.category,
          priority: data.priority,
          status: TicketStatus.OPEN,
          creatorId: req.user!.id,
          creatorRole,
          vendorId: data.vendorId ?? null,
          orderId: data.orderId ?? null,
          orderItemId: data.orderItemId ?? null,
          productId: data.productId ?? null,
          lastMessageAt: now,
          // The requester just created it; the agent side has 1 unread.
          agentUnread: 1,
          customerUnread: 0,
          customerLastReadAt: now,
        },
      });
      await tx.supportMessage.create({
        data: {
          ticketId: t.id,
          authorId: req.user!.id,
          authorRole: creatorRole,
          authorName: me?.name ?? 'User',
          body: data.body,
          attachments: data.attachments ?? [],
          flagged: !!piiReason,
          flagReason: piiReason,
        },
      });
      return tx.supportTicket.findUniqueOrThrow({ where: { id: t.id }, include: TICKET_INCLUDE });
    });

    const dto = serializeTicket(ticket, 'requester');

    // Notifications (best-effort, never block the response).
    if (me?.email) {
      sendSupportTicketReceivedEmail(me.email, {
        ticketNumber,
        subject: data.subject,
        link: ticketLink(req.user!.role === Role.VENDOR ? 'vendor' : 'web', ticket.id),
      }).catch((e) => console.warn('[support] received-email failed:', e?.message));
    }
    await notifyCounterpartOnMessage(ticket, { isRequester: true, fromName: me?.name ?? 'User', preview: data.body });

    res.status(201).json(dto);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Caller's own tickets
// ─────────────────────────────────────────────────────────────────────────────

// Total unread for the caller (drives the nav bell badge, app-wide). Sums the
// requester-side counter on their own tickets plus the agent-side counter on
// the queue they handle (vendor → their tickets; admin → platform queue).
router.get('/unread-count', requireAuth, async (req, res, next) => {
  try {
    const me = req.user!;
    const reqAgg = await prisma.supportTicket.aggregate({
      _sum: { customerUnread: true },
      where: { creatorId: me.id },
    });
    const requester = reqAgg._sum.customerUnread ?? 0;

    let agent = 0;
    if (me.role === Role.VENDOR) {
      const vendor = await getVendor(me.id);
      if (vendor) {
        const a = await prisma.supportTicket.aggregate({ _sum: { agentUnread: true }, where: { vendorId: vendor.id } });
        agent = a._sum.agentUnread ?? 0;
      }
    } else if (me.role === Role.ADMIN) {
      const a = await prisma.supportTicket.aggregate({ _sum: { agentUnread: true }, where: { vendorId: null } });
      agent = a._sum.agentUnread ?? 0;
    }
    res.json({ unread: requester + agent, requester, agent });
  } catch (e) { next(e); }
});

router.get('/tickets', requireAuth, async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined)?.split(',').filter(Boolean) as TicketStatus[] | undefined;
    const category = req.query.category as TicketCategory | undefined;
    const rows = await prisma.supportTicket.findMany({
      where: {
        creatorId: req.user!.id,
        ...(status?.length ? { status: { in: status } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      include: TICKET_INCLUDE,
    });
    res.json(rows.map((t) => serializeTicket(t, 'requester')));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Single ticket + thread
// ─────────────────────────────────────────────────────────────────────────────

async function loadAccess(req: any, ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId }, include: TICKET_INCLUDE });
  if (!ticket) return { ticket: null as any, access: null as any };
  const user: Actor = { id: req.user.id, role: req.user.role };
  const userVendorId = await resolveVendorId(user);
  const access = evaluateTicketAccess(user, ticket, userVendorId);
  return { ticket, access };
}

router.get('/tickets/:id', requireAuth, async (req, res, next) => {
  try {
    const { ticket, access } = await loadAccess(req, req.params.id);
    if (!ticket || !access.canAccess) return res.status(404).json({ error: 'Ticket not found' });
    const dto = serializeTicket(ticket, access.isRequester ? 'requester' : 'agent');
    res.json({ ...dto, canSeeInternalNotes: access.canSeeInternalNotes });
  } catch (e) { next(e); }
});

router.get('/tickets/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const { ticket, access } = await loadAccess(req, req.params.id);
    if (!ticket || !access.canAccess) return res.status(404).json({ error: 'Ticket not found' });
    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: ticket.id, ...(access.canSeeInternalNotes ? {} : { isInternalNote: false }) },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages.map(serializeMessage));
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Send a message — THE source of truth. Persist, update ticket state, then
// notify the room and email the counterpart.
// ─────────────────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  attachments: z.array(z.string().url()).max(6).optional(),
  isInternalNote: z.boolean().optional(),
});

// Notify the side that did NOT just post — across three channels: in-app socket
// toast/badge, browser web-push, and email. Skipped for internal notes.
async function notifyCounterpartOnMessage(
  ticket: any,
  opts: { isRequester: boolean; fromName: string; preview: string },
) {
  const preview = opts.preview.slice(0, 240);
  const shortPreview = opts.preview.slice(0, 140);
  const notify = {
    ticketId: ticket.id, ticketNumber: ticket.ticketNumber, subject: ticket.subject,
    fromName: opts.fromName, preview: shortPreview,
  };
  const pushPayload = { title: `${opts.fromName} · ${ticket.ticketNumber}`, body: shortPreview, ticketId: ticket.id };

  try {
    if (opts.isRequester) {
      // requester → agent side
      if (ticket.vendorId) {
        const vendor = await prisma.vendor.findUnique({
          where: { id: ticket.vendorId },
          select: { userId: true, user: { select: { email: true } } },
        });
        if (vendor?.userId) {
          emitNotifyToUser(vendor.userId, notify);
          sendPushToUser(vendor.userId, pushPayload).catch(() => {});
        }
        if (vendor?.user?.email) {
          await sendSupportMessageEmail(vendor.user.email, {
            ticketNumber: ticket.ticketNumber, subject: ticket.subject,
            fromName: opts.fromName, preview, link: ticketLink('vendor', ticket.id),
          });
        }
      } else {
        // platform queue → all admins (socket) + assigned admin (push) + fallback email
        emitNotifyToAdmins(notify);
        if (ticket.assignedToId) sendPushToUser(ticket.assignedToId, pushPayload).catch(() => {});
        const to = process.env.SUPPORT_NOTIFY_EMAIL
          || (ticket.assignedToId
            ? (await prisma.user.findUnique({ where: { id: ticket.assignedToId }, select: { email: true } }))?.email
            : null);
        if (to) {
          await sendSupportMessageEmail(to, {
            ticketNumber: ticket.ticketNumber, subject: ticket.subject,
            fromName: opts.fromName, preview, link: ticketLink('admin', ticket.id),
          });
        }
      }
    } else {
      // agent → requester
      emitNotifyToUser(ticket.creatorId, notify);
      sendPushToUser(ticket.creatorId, pushPayload).catch(() => {});
      const creator = await prisma.user.findUnique({ where: { id: ticket.creatorId }, select: { email: true } });
      if (creator?.email) {
        await sendSupportMessageEmail(creator.email, {
          ticketNumber: ticket.ticketNumber, subject: ticket.subject,
          fromName: opts.fromName, preview,
          link: ticketLink(ticket.creatorRole === SenderRole.VENDOR ? 'vendor' : 'web', ticket.id),
        });
      }
    }
  } catch (e: any) {
    console.warn('[support] message-notify failed:', e?.message);
  }
}

router.post('/tickets/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { body, attachments } = parsed.data;

    const { ticket, access } = await loadAccess(req, req.params.id);
    if (!ticket || !access.canAccess) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.status === TicketStatus.CLOSED) {
      return res.status(400).json({ error: 'This ticket is closed. Please open a new request.' });
    }

    const isStaff = access.canSeeInternalNotes;
    const internalNote = !!parsed.data.isInternalNote && isStaff; // only staff can post internal notes
    const isRequester = access.isRequester;
    const me = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } });
    const authorName = me?.name ?? 'User';
    const authorRole = senderFromRole(req.user!.role);
    const now = new Date();
    const piiReason = internalNote ? null : detectPii(body);

    const ticketUpdate: Prisma.SupportTicketUpdateInput = { lastMessageAt: now };
    if (!internalNote) {
      if (isRequester) {
        ticketUpdate.agentUnread = { increment: 1 };
        ticketUpdate.customerUnread = 0;
        ticketUpdate.customerLastReadAt = now;
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.AWAITING_CUSTOMER) {
          ticketUpdate.status = TicketStatus.OPEN; // reopen / ball back to agent
        }
      } else {
        ticketUpdate.customerUnread = { increment: 1 };
        ticketUpdate.agentUnread = 0;
        ticketUpdate.agentLastReadAt = now;
        if (!ticket.firstResponseAt) ticketUpdate.firstResponseAt = now;
        if (ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.PENDING) {
          ticketUpdate.status = TicketStatus.AWAITING_CUSTOMER;
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.supportMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: req.user!.id,
          authorRole,
          authorName,
          body,
          attachments: attachments ?? [],
          isInternalNote: internalNote,
          flagged: !!piiReason,
          flagReason: piiReason,
        },
      });
      const updated = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: ticketUpdate,
        include: TICKET_INCLUDE,
      });
      return { message, updated };
    });

    const msgDto = serializeMessage(result.message);
    // Notify the room (internal notes go only to the staff sub-room).
    emitNewMessage(ticket.id, msgDto, internalNote);
    if (!internalNote && ticketUpdate.status) {
      emitTicketUpdate(ticket.id, serializeTicket(result.updated, 'agent'));
    }
    if (!internalNote) {
      notifyCounterpartOnMessage(result.updated, { isRequester, fromName: authorName, preview: body });
    }

    res.status(201).json(msgDto);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Mark the caller's side as read
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/tickets/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { ticket, access } = await loadAccess(req, req.params.id);
    if (!ticket || !access.canAccess) return res.status(404).json({ error: 'Ticket not found' });
    const side: ViewerSide = access.isRequester ? 'requester' : 'agent';
    const now = new Date();

    await prisma.$transaction([
      prisma.supportTicket.update({
        where: { id: ticket.id },
        data: side === 'requester'
          ? { customerUnread: 0, customerLastReadAt: now }
          : { agentUnread: 0, agentLastReadAt: now },
      }),
      prisma.supportMessage.updateMany({
        where: { ticketId: ticket.id, authorId: { not: req.user!.id }, isInternalNote: false, readAt: null },
        data: { readAt: now },
      }),
    ]);

    emitTicketRead(ticket.id, { side, readAt: now.toISOString() });
    res.json({ ok: true, side });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Vendor inbox
// ─────────────────────────────────────────────────────────────────────────────

router.get('/vendor/tickets', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const status = (req.query.status as string | undefined)?.split(',').filter(Boolean) as TicketStatus[] | undefined;
    const category = req.query.category as TicketCategory | undefined;
    const unreadOnly = req.query.unread === '1';
    const rows = await prisma.supportTicket.findMany({
      where: {
        vendorId: vendor.id,
        ...(status?.length ? { status: { in: status } } : {}),
        ...(category ? { category } : {}),
        ...(unreadOnly ? { agentUnread: { gt: 0 } } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      include: TICKET_INCLUDE,
    });
    res.json(rows.map((t) => serializeTicket(t, 'agent')));
  } catch (e) { next(e); }
});

const vendorPatchSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
});

router.patch('/vendor/tickets/:id', requireAuth, requireRole(Role.VENDOR), async (req, res, next) => {
  try {
    const vendor = await getVendor(req.user!.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const parsed = vendorPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket || ticket.vendorId !== vendor.id) return res.status(404).json({ error: 'Ticket not found' });

    if (parsed.data.status && parsed.data.status !== ticket.status) {
      if (!STATUS_FLOW[ticket.status].includes(parsed.data.status)) {
        return res.status(400).json({ error: `Cannot move a ${ticket.status} ticket to ${parsed.data.status}` });
      }
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status, ...statusStamps(parsed.data.status) } : {}),
        ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      },
      include: TICKET_INCLUDE,
    });
    const dto = serializeTicket(updated, 'agent');
    emitTicketUpdate(updated.id, dto);
    res.json(dto);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin global queue
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/tickets', requireAuth, requirePermission(Permission.SUPPORT_VIEW), async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined)?.split(',').filter(Boolean) as TicketStatus[] | undefined;
    const category = req.query.category as TicketCategory | undefined;
    const scope = req.query.scope as 'platform' | 'vendor' | undefined; // platform = vendorId null
    const vendorId = req.query.vendorId as string | undefined;
    const assignedToId = req.query.assignedToId as string | undefined;
    const flagged = req.query.flagged === '1';
    const q = (req.query.q as string | undefined)?.trim();

    const where: Prisma.SupportTicketWhereInput = {
      ...(status?.length ? { status: { in: status } } : {}),
      ...(category ? { category } : {}),
      ...(scope === 'platform' ? { vendorId: null } : {}),
      ...(scope === 'vendor' ? { vendorId: { not: null } } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(flagged ? { messages: { some: { flagged: true } } } : {}),
      ...(q ? { OR: [{ subject: { contains: q, mode: 'insensitive' } }, { ticketNumber: { contains: q, mode: 'insensitive' } }] } : {}),
    };

    const rows = await prisma.supportTicket.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: TICKET_INCLUDE,
    });
    res.json(rows.map((t) => serializeTicket(t, 'agent')));
  } catch (e) { next(e); }
});

router.get('/admin/stats', requireAuth, requirePermission(Permission.SUPPORT_VIEW), async (_req, res, next) => {
  try {
    const grouped = await prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus: Record<string, number> = {};
    for (const g of grouped) byStatus[g.status] = g._count._all;
    const unassignedOpen = await prisma.supportTicket.count({
      where: { assignedToId: null, status: { in: [TicketStatus.OPEN, TicketStatus.PENDING] } },
    });
    res.json({ byStatus, unassignedOpen });
  } catch (e) { next(e); }
});

const adminPatchSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

router.patch('/admin/tickets/:id', requireAuth, requirePermission(Permission.SUPPORT_MANAGE), async (req, res, next) => {
  try {
    const parsed = adminPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (parsed.data.assignedToId) {
      const u = await prisma.user.findUnique({ where: { id: parsed.data.assignedToId }, select: { role: true } });
      if (!u || u.role !== Role.ADMIN) return res.status(400).json({ error: 'Can only assign to an admin user' });
    }

    const data: Prisma.SupportTicketUncheckedUpdateInput = {
      ...(parsed.data.status ? { status: parsed.data.status, ...statusStamps(parsed.data.status) } : {}),
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.assignedToId !== undefined ? { assignedToId: parsed.data.assignedToId } : {}),
      ...(parsed.data.tags ? { tags: parsed.data.tags } : {}),
    };
    const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data, include: TICKET_INCLUDE });
    const { audit } = await import('../lib/audit');
    await audit(req.user!.id, 'support.ticket.updated', ticket.id, { ...parsed.data });
    const dto = serializeTicket(updated, 'agent');
    emitTicketUpdate(updated.id, dto);
    res.json(dto);
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI draft reply (agents only — owning vendor or admin)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/tickets/:id/ai-draft', requireAuth, requireRole(Role.VENDOR, Role.ADMIN), async (req, res, next) => {
  try {
    const { ticket, access } = await loadAccess(req, req.params.id);
    if (!ticket || !access.canAccess) return res.status(404).json({ error: 'Ticket not found' });
    if (!access.canSeeInternalNotes) return res.status(403).json({ error: 'Forbidden' });

    const messages = await prisma.supportMessage.findMany({
      where: { ticketId: ticket.id, isInternalNote: false },
      orderBy: { createdAt: 'asc' },
      select: { authorRole: true, authorName: true, body: true },
    });
    const { draft, source } = await draftSupportReply({
      subject: ticket.subject,
      category: ticket.category,
      shopName: ticket.vendor?.shopName ?? undefined,
      messages: messages.map((m) => ({ role: m.authorRole, authorName: m.authorName, body: m.body })),
    });
    res.json({ draft, source, available: aiAvailable() });
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Canned / saved replies (agents: vendor scope, or admin/platform scope)
// ─────────────────────────────────────────────────────────────────────────────

const cannedSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  category: z.nativeEnum(TicketCategory).nullable().optional(),
  isShared: z.boolean().optional(),
});

router.get('/canned', requireAuth, requireRole(Role.VENDOR, Role.ADMIN), async (req, res, next) => {
  try {
    const vendor = req.user!.role === Role.VENDOR ? await getVendor(req.user!.id) : null;
    if (req.user!.role === Role.VENDOR && !vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const where: Prisma.CannedReplyWhereInput = vendor
      ? { vendorId: vendor.id, OR: [{ isShared: true }, { createdById: req.user!.id }] }
      : { vendorId: null, OR: [{ isShared: true }, { createdById: req.user!.id }] };
    const rows = await prisma.cannedReply.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/canned', requireAuth, requireRole(Role.VENDOR, Role.ADMIN), async (req, res, next) => {
  try {
    const parsed = cannedSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const vendor = req.user!.role === Role.VENDOR ? await getVendor(req.user!.id) : null;
    if (req.user!.role === Role.VENDOR && !vendor) return res.status(404).json({ error: 'Vendor profile not created' });
    const created = await prisma.cannedReply.create({
      data: {
        vendorId: vendor?.id ?? null,
        createdById: req.user!.id,
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category ?? null,
        isShared: parsed.data.isShared ?? true,
      },
    });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

async function authorizeCanned(req: any): Promise<{ ok: boolean; row?: any }> {
  const row = await prisma.cannedReply.findUnique({ where: { id: req.params.id } });
  if (!row) return { ok: false };
  if (row.createdById === req.user.id) return { ok: true, row };
  if (req.user.role === Role.ADMIN && row.vendorId === null) return { ok: true, row };
  if (req.user.role === Role.VENDOR) {
    const vendor = await getVendor(req.user.id);
    if (vendor && row.vendorId === vendor.id) return { ok: true, row };
  }
  return { ok: false };
}

router.patch('/canned/:id', requireAuth, requireRole(Role.VENDOR, Role.ADMIN), async (req, res, next) => {
  try {
    const parsed = cannedSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { ok, row } = await authorizeCanned(req);
    if (!ok) return res.status(404).json({ error: 'Reply not found' });
    const updated = await prisma.cannedReply.update({
      where: { id: row.id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        ...(parsed.data.isShared !== undefined ? { isShared: parsed.data.isShared } : {}),
      },
    });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/canned/:id', requireAuth, requireRole(Role.VENDOR, Role.ADMIN), async (req, res, next) => {
  try {
    const { ok, row } = await authorizeCanned(req);
    if (!ok) return res.status(404).json({ error: 'Reply not found' });
    await prisma.cannedReply.delete({ where: { id: row.id } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Web Push subscriptions (browser notifications)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/push/key', requireAuth, (_req, res) => {
  const key = vapidPublicKey();
  res.json({ key, available: !!key });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  urlTemplate: z.string().max(500).optional(),
});

router.post('/push/subscribe', requireAuth, async (req, res, next) => {
  try {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { endpoint, keys, urlTemplate } = parsed.data;
    const ua = (req.headers['user-agent'] as string | undefined)?.slice(0, 300) ?? null;
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: req.user!.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, urlTemplate: urlTemplate ?? null, userAgent: ua },
      update: { userId: req.user!.id, p256dh: keys.p256dh, auth: keys.auth, urlTemplate: urlTemplate ?? null, userAgent: ua },
    });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/push/unsubscribe', requireAuth, async (req, res, next) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null;
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    // Only delete the caller's own subscription.
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
