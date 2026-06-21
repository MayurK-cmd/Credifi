/**
 * Prisma client singleton.
 *
 * Prisma's docs warn that each `PrismaClient` instance opens its own
 * connection pool. In serverless / hot-reload contexts (Neon, tsx watch,
 * Next.js dev) creating a fresh instance per module-eval leaks connections
 * until the DB refuses new ones. The standard fix is to cache one instance
 * on `globalThis` for the process lifetime.
 *
 * Usage:
 *   import { prisma, Prisma } from "./db.js";
 *   const wallets = await prisma.wallet.findMany();
 *   const loan = await prisma.loan.create({ data: { ... } });
 *
 * The generated `@prisma/client` types live in node_modules after
 * `npm run db:generate`. This file does not need to be re-edited when
 * the schema changes — only when the runtime API does.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["query", "warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export the Prisma namespace so callers can do
// `Prisma.LoanScalarFieldEnum.borrowTxHash` etc. without a second import.
export { Prisma } from "@prisma/client";
