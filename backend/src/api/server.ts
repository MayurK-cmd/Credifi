/**
 * Fastify server bootstrap.
 *
 *   - Registers CORS, JSON body parsing
 *   - Mounts /api/score, /api/loan, /api/pool route plugins
 *   - Exposes /health (used by demos / uptime checks)
 *   - Starts the indexer in the background
 *   - Wires graceful shutdown: stop indexer, close Fastify, close Prisma
 */
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "../config.js";
import { fetchLiveChainId, getOracle, getPool } from "../chain/provider.js";
import { prisma } from "../db.js";
import { indexOnce, runForever } from "../indexer/indexer.js";
import { scoreRoutes } from "./routes/score.js";
import { loanRoutes } from "./routes/loan.js";
import { poolRoutes } from "./routes/pool.js";

const stopSignal = { stopped: false };

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { colorize: true } },
    },
    bodyLimit: 1_048_576, // 1 MB
  });

  // CORS — wide-open in dev, restrict in prod via env.
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? true,
  });

  app.get("/health", async () => {
    let dbStatus: "up" | "down" = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "up";
    } catch {
      dbStatus = "down";
    }
    let chainId: number | null = null;
    try {
      chainId = await fetchLiveChainId();
    } catch {
      chainId = null;
    }
    return {
      ok: true,
      db: dbStatus,
      chainId,
      configuredChainId: config.chainId,
      oracleAddr: config.oracleAddress,
      poolAddr: config.poolAddress,
    };
  });

  await app.register(scoreRoutes);
  await app.register(loanRoutes);
  await app.register(poolRoutes);

  // Force-construct the Contract objects so the first request doesn't pay
  // the ABIs-parse cost. Also fails fast at boot if the addresses are bad.
  void getOracle();
  void getPool();

  return app;
}

export async function bootstrap(): Promise<void> {
  const app = await buildServer();

  // Start the indexer in the background. indexOnce() runs synchronously,
  // so we schedule a microtask off the boot path.
  void (async () => {
    try {
      console.log("[indexer] starting…");
      await runForever(stopSignal);
    } catch (err) {
      console.error("[indexer] fatal:", err);
    }
  })();

  // Hook graceful shutdown.
  const shutdown = async (signal: string) => {
    console.log(`\n[server] received ${signal}, shutting down…`);
    stopSignal.stopped = true;
    try {
      await app.close();
    } catch (err) {
      console.error("[server] error closing fastify:", err);
    }
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.error("[server] error disconnecting prisma:", err);
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`[server] listening on http://0.0.0.0:${config.port}`);
  console.log(`[server] configured: chainId=${config.chainId} oracle=${config.oracleAddress} pool=${config.poolAddress}`);
}

// Standalone helper for the catchup CLI.
export { indexOnce };
