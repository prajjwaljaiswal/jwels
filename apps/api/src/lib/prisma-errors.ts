// Helpers for classifying Prisma errors.

// Prisma "can't talk to the database" error codes — these are transient/
// environmental (server unreachable, timed out, connection dropped by the
// pooler) rather than bugs in our queries. Hosted/pooled Postgres (e.g. Prisma
// Postgres) can briefly become unreachable when idle, so background jobs should
// treat these as "skip this tick and retry later", not as hard failures.
const CONNECTION_ERROR_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017']);

export function isDbConnectionError(e: unknown): boolean {
  const code = (e as any)?.code;
  return typeof code === 'string' && CONNECTION_ERROR_CODES.has(code);
}
