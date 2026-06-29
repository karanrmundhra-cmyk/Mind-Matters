import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton — avoids exhausting connections during dev HMR.
 * All queries are tenant-scoped at the service layer; RLS is the backstop.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Fallback URL so client construction never throws when DATABASE_URL is unset — in that
// case the app uses the in-memory repository (getRepository), so this client is never queried.
const PLACEHOLDER_DB_URL = 'postgresql://user:pass@127.0.0.1:5432/placeholder';

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL ?? PLACEHOLDER_DB_URL,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
