import { prisma } from './prisma';

export async function audit(
  actorId: string,
  action: string,
  target?: string | null,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        target: target ?? null,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });
  } catch (e) {
    console.error('audit log write failed', { action, target, error: e });
  }
}
