'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePermissions } from '@/lib/permissions';

export default function RbacLayout({ children }: { children: React.ReactNode }) {
  const { has, loading } = usePermissions();
  const pathname = usePathname();
  const router = useRouter();

  const required = pathname?.startsWith('/rbac/audit') ? 'AUDIT_VIEW' : 'RBAC_MANAGE';
  const allowed = has(required);

  useEffect(() => {
    if (!loading && !allowed) router.replace('/');
  }, [loading, allowed, router]);

  if (loading) {
    return <div className="p-6 text-sm text-ink-700">Checking permissions…</div>;
  }
  if (!allowed) {
    return <div className="p-6 text-sm text-ink-700">You do not have permission to view this page.</div>;
  }
  return <>{children}</>;
}
