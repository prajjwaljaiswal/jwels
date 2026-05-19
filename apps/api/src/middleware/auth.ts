import { Request, Response, NextFunction } from 'express';
import { Role, Permission } from '@prisma/client';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; permissions?: Permission[] };
    }
  }
}

const PERMISSION_CACHE_TTL_MS = 60_000;
const permissionCache = new Map<string, { perms: Permission[]; expiresAt: number }>();

export function invalidatePermissionCache(userId?: string) {
  if (userId) permissionCache.delete(userId);
  else permissionCache.clear();
}

export async function loadPermissions(userId: string): Promise<Permission[]> {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.perms;

  const rows = await prisma.userAdminRole.findMany({
    where: { userId },
    include: { role: { select: { name: true, permissions: true } } },
  });

  const isSuper = rows.some((r) => r.role.name === 'SUPER_ADMIN');
  const perms = isSuper
    ? (Object.values(Permission) as Permission[])
    : Array.from(new Set(rows.flatMap((r) => r.role.permissions)));

  permissionCache.set(userId, { perms, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });
  return perms;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  req.user = { id: payload.userId, role: payload.role };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * Gate an admin route on one or more permissions. Caller must already be ADMIN
 * (this middleware enforces it). User must have ALL listed permissions.
 * SUPER_ADMIN role short-circuits to allow.
 */
export function requireAnyPermission(...anyOf: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.role !== Role.ADMIN) return res.status(403).json({ error: 'Forbidden' });
    try {
      const perms = await loadPermissions(req.user.id);
      req.user.permissions = perms;
      if (!anyOf.some((p) => perms.includes(p))) {
        return res.status(403).json({ error: 'Forbidden', requiredAnyOf: anyOf });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requirePermission(...required: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.user.role !== Role.ADMIN) return res.status(403).json({ error: 'Forbidden' });
    try {
      const perms = await loadPermissions(req.user.id);
      req.user.permissions = perms;
      const missing = required.filter((p) => !perms.includes(p));
      if (missing.length > 0) {
        return res.status(403).json({ error: 'Forbidden', missingPermissions: missing });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
