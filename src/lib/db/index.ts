import { PrismaClient, type Prisma } from "@prisma/client";

/**
 * Prisma client singleton — Next.js dev-hot-reload-safe pattern.
 *
 * In development, Next.js's module hot-reload re-executes this module on
 * every file change, which would otherwise create a new PrismaClient (and a
 * new DB connection pool) on every reload and eventually exhaust available
 * connections. Caching the instance on `globalThis` survives hot reloads
 * because `globalThis` is not re-initialized between them; in production
 * (single module evaluation) the global cache is a no-op convenience.
 *
 * SPEC-AUTH-001 M1 — see prisma/schema.prisma for the User / OAuthAccount /
 * RefreshToken models this client exposes delegates for (`prisma.user`,
 * `prisma.oAuthAccount`, `prisma.refreshToken`).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Verbose query logging only in development; errors/warnings always. */
export function getPrismaLogLevels(nodeEnv: string | undefined): Prisma.LogLevel[] {
  return nodeEnv === "development" ? ["warn", "error"] : ["error"];
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getPrismaLogLevels(process.env.NODE_ENV),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
