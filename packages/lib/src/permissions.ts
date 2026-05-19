'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

export const PERMISSIONS = [
  'VENDOR_VIEW',
  'VENDOR_APPROVE',
  'VENDOR_SUSPEND',
  'PAYOUT_VIEW',
  'PAYOUT_PROCESS',
  'CATEGORY_MANAGE',
  'SETTINGS_MANAGE',
  'ORDER_VIEW',
  'ORDER_REFUND',
  'USER_VIEW',
  'USER_MANAGE_ROLES',
  'RBAC_MANAGE',
  'AUDIT_VIEW',
  'PAYMENT_METHOD_VIEW',
  'PAYMENT_METHOD_MANAGE',
] as const;

export type Permission = typeof PERMISSIONS[number];

interface Me {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'VENDOR' | 'ADMIN';
  permissions: Permission[];
}

let cachedMe: Me | null = null;
let inflight: Promise<Me | null> | null = null;

async function fetchMe(): Promise<Me | null> {
  if (cachedMe) return cachedMe;
  if (inflight) return inflight;
  inflight = api<Me>('/api/auth/me', { silent: true })
    .then((m) => { cachedMe = m; return m; })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

export function clearMeCache() {
  cachedMe = null;
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(cachedMe);
  const [loading, setLoading] = useState(!cachedMe);
  useEffect(() => {
    let cancelled = false;
    fetchMe().then((m) => {
      if (!cancelled) { setMe(m); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);
  return { me, loading };
}

export function usePermissions() {
  const { me, loading } = useMe();
  const perms = me?.permissions ?? [];
  return {
    loading,
    permissions: perms,
    has: (p: Permission) => perms.includes(p),
    hasAny: (...ps: Permission[]) => ps.some((p) => perms.includes(p)),
    hasAll: (...ps: Permission[]) => ps.every((p) => perms.includes(p)),
  };
}
