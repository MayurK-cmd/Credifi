/**
 * /api/loan/* routes.
 *
 *   GET /api/loan/:address       -> recent loans (any status)
 *   GET /api/loan/:address/active-> currently active loans
 */
import type { FastifyInstance } from "fastify";
import { getAddress } from "ethers";
import { prisma } from "../../db.js";

function normalizeAddress(address: string): string {
  try {
    return getAddress(address).toLowerCase();
  } catch {
    const e = new Error(`Invalid address: ${address}`) as Error & { statusCode: number };
    e.statusCode = 400;
    throw e;
  }
}

const LOAN_HISTORY_DEFAULT = 50;

export async function loanRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { address: string } }>("/api/loan/:address", async (req) => {
    const address = normalizeAddress(req.params.address);
    const loans = await prisma.loan.findMany({
      where: { walletAddr: address },
      orderBy: { borrowedAt: "desc" },
      take: LOAN_HISTORY_DEFAULT,
    });
    return {
      address,
      count: loans.length,
      loans: loans.map((l) => ({
        id: l.id,
        principal: l.principal,
        collateralLocked: l.collateralLocked,
        tierAtBorrow: l.tierAtBorrow,
        status: l.status,
        borrowedAt: l.borrowedAt.toISOString(),
        repaidAt: l.repaidAt?.toISOString() ?? null,
        borrowTxHash: l.borrowTxHash,
        repayTxHash: l.repayTxHash,
      })),
    };
  });

  app.get<{ Params: { address: string } }>("/api/loan/:address/active", async (req) => {
    const address = normalizeAddress(req.params.address);
    const loans = await prisma.loan.findMany({
      where: { walletAddr: address, status: "active" },
      orderBy: { borrowedAt: "desc" },
    });
    return {
      address,
      count: loans.length,
      loans: loans.map((l) => ({
        id: l.id,
        principal: l.principal,
        collateralLocked: l.collateralLocked,
        tierAtBorrow: l.tierAtBorrow,
        borrowedAt: l.borrowedAt.toISOString(),
        borrowTxHash: l.borrowTxHash,
      })),
    };
  });
}
