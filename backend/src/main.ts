/**
 * CrediFi backend entry point.
 *
 * Boot order:
 *   1. dotenv (loaded via config.ts's first import)
 *   2. Build the Fastify server (registers routes, validates config)
 *   3. Start the indexer in the background
 *   4. Listen on $PORT
 */
import { bootstrap } from "./api/server.js";

bootstrap().catch((err) => {
  console.error("[main] fatal during bootstrap:", err);
  process.exit(1);
});
