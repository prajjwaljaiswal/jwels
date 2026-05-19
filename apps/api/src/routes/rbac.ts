import { Router } from 'express';
import { z } from 'zod';
import { Permission, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  requireAuth,
  requireRole,
  requirePermission,
  invalidatePermissionCache,
} from '../middleware/auth';
import { audit } from '../lib/audit';

const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN));

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

// ─── Permissions catalog ─────────────────────────────────────────────────────

router.get('/permissions', requirePermission(Permission.RBAC_MANAGE), (_req, res) => {
  res.json(ALL_PERMISSIONS);
});

// ─── Roles ───────────────────────────────────────────────────────────────────

router.get('/roles', requirePermission(Permission.RBAC_MANAGE), async (_req, res, next) => {
  try {
    const roles = await prisma.adminRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    res.json(roles);
  } catch (e) { next(e); }
});

const roleSchema = z.object({
  name: z.string().min(2).max(64).regex(/^[A-Z0-9_]+$/, 'Use UPPER_SNAKE_CASE'),
  description: z.string().max(500).optional(),
  permissions: z.array(z.nativeEnum(Permission)).default([]),
});

router.post('/roles', requirePermission(Permission.RBAC_MANAGE), async (req, res, next) => {
  try {
    const data = roleSchema.parse(req.body);
    const existing = await prisma.adminRole.findUnique({ where: { name: data.name } });
    if (existing) return res.status(409).json({ error: 'Role name already exists' });
    const role = await prisma.adminRole.create({
      data: { name: data.name, description: data.description, permissions: data.permissions, isSystem: false },
    });
    await audit(req.user!.id, 'rbac.role.create', role.id, { name: role.name, permissions: role.permissions });
    res.status(201).json(role);
  } catch (e) { next(e); }
});

const roleUpdateSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  permissions: z.array(z.nativeEnum(Permission)).optional(),
});

router.patch('/roles/:id', requirePermission(Permission.RBAC_MANAGE), async (req, res, next) => {
  try {
    const data = roleUpdateSchema.parse(req.body);
    const existing = await prisma.adminRole.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.isSystem) return res.status(403).json({ error: 'System roles cannot be modified' });

    const role = await prisma.adminRole.update({
      where: { id: req.params.id },
      data: {
        description: data.description ?? undefined,
        ...(data.permissions ? { permissions: { set: data.permissions } } : {}),
      },
    });

    if (data.permissions) {
      const affected = await prisma.userAdminRole.findMany({ where: { roleId: role.id }, select: { userId: true } });
      for (const a of affected) invalidatePermissionCache(a.userId);
    }

    await audit(req.user!.id, 'rbac.role.update', role.id, { permissions: role.permissions });
    res.json(role);
  } catch (e) { next(e); }
});

router.delete('/roles/:id', requirePermission(Permission.RBAC_MANAGE), async (req, res, next) => {
  try {
    const existing = await prisma.adminRole.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Role not found' });
    if (existing.isSystem) return res.status(403).json({ error: 'System roles cannot be deleted' });
    if (existing._count.users > 0) {
      return res.status(409).json({ error: `Role is assigned to ${existing._count.users} user(s); revoke first.` });
    }
    await prisma.adminRole.delete({ where: { id: existing.id } });
    await audit(req.user!.id, 'rbac.role.delete', existing.id, { name: existing.name });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ─── User ↔ Role assignments ────────────────────────────────────────────────

router.get('/users', requirePermission(Permission.RBAC_MANAGE), async (req, res, next) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    const users = await prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        adminRoles: { include: { role: { select: { id: true, name: true, isSystem: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(users);
  } catch (e) { next(e); }
});

const assignSchema = z.object({ roleId: z.string().uuid() });

router.post('/users/:id/roles', requirePermission(Permission.RBAC_MANAGE), async (req, res, next) => {
  try {
    const { roleId } = assignSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role !== Role.ADMIN) return res.status(400).json({ error: 'Target user is not an admin' });

    const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    await prisma.userAdminRole.upsert({
      where: { userId_roleId: { userId: target.id, roleId: role.id } },
      update: {},
      create: { userId: target.id, roleId: role.id, assignedBy: req.user!.id },
    });
    invalidatePermissionCache(target.id);
    await audit(req.user!.id, 'rbac.user.role.assign', target.id, { roleId, roleName: role.name });
    res.status(204).end();
  } catch (e) { next(e); }
});

router.delete(
  '/users/:id/roles/:roleId',
  requirePermission(Permission.RBAC_MANAGE),
  async (req, res, next) => {
    try {
      const { id: userId, roleId } = req.params;

      // Prevent removing the last SUPER_ADMIN assignment from the system.
      const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
      if (!role) return res.status(404).json({ error: 'Role not found' });
      if (role.name === 'SUPER_ADMIN') {
        const superCount = await prisma.userAdminRole.count({ where: { roleId } });
        if (superCount <= 1) {
          return res.status(409).json({ error: 'Cannot remove the last SUPER_ADMIN assignment' });
        }
      }

      await prisma.userAdminRole.delete({
        where: { userId_roleId: { userId, roleId } },
      }).catch(() => null);
      invalidatePermissionCache(userId);
      await audit(req.user!.id, 'rbac.user.role.revoke', userId, { roleId, roleName: role.name });
      res.status(204).end();
    } catch (e) { next(e); }
  },
);

// ─── Audit log ───────────────────────────────────────────────────────────────

router.get('/audit', requirePermission(Permission.AUDIT_VIEW), async (req, res, next) => {
  try {
    const take = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor as string | undefined;
    const action = req.query.action as string | undefined;
    const actorId = req.query.actorId as string | undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(actorId ? { actorId } : {}),
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = logs.length > take;
    const page = hasMore ? logs.slice(0, take) : logs;
    res.json({
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (e) { next(e); }
});

export default router;
