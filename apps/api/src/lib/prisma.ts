import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Gracefully handle connection drops from the pooler (PgBouncer / Prisma Accelerate).
// On closed-connection errors Prisma will automatically reconnect on the next query,
// so we just suppress the noise here.
prisma.$on('error' as never, () => {
  // intentionally empty — Prisma auto-reconnects
});
