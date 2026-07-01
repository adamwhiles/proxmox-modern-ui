import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import staticPlugin from "@fastify/static";
import { config } from "./config.js";
import { ensureSchema } from "./db/client.js";
import securityPlugin from "./plugins/security.js";
import sessionPlugin from "./plugins/session.js";
import { requiresCsrfCheck, verifyCsrf } from "./security/csrf.js";
import authRoutes from "./modules/auth/routes.js";
import clusterRoutes from "./modules/clusters/routes.js";
import dashboardRoutes from "./modules/dashboard/routes.js";
import nodeRoutes from "./modules/nodes/routes.js";
import guestRoutes from "./modules/guests/routes.js";
import taskRoutes from "./modules/tasks/routes.js";
import storageRoutes from "./modules/storage/routes.js";
import networkRoutes from "./modules/network/routes.js";
import backupRoutes from "./modules/backup/routes.js";
import auditRoutes from "./modules/audit/routes.js";
import consoleRoutes from "./modules/console/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  ensureSchema();

  const app = Fastify({
    logger: {
      transport: config.isProduction ? undefined : { target: "pino-pretty" },
      // Never log full request bodies/headers — they may carry the CSRF token or Proxmox creds.
      redact: ["req.headers.cookie", "req.headers['x-csrf-token']", "req.body.password"],
    },
    trustProxy: true, // honor X-Forwarded-* when deployed behind a reverse proxy
  });

  await app.register(securityPlugin);
  await app.register(sessionPlugin);
  await app.register(websocketPlugin);

  // Global CSRF enforcement for every state-changing API request that carries a session cookie.
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    if (!requiresCsrfCheck(request)) return;
    if (!verifyCsrf(request)) {
      reply.code(403).send({ error: "Invalid or missing CSRF token" });
    }
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(clusterRoutes, { prefix: "/api/clusters" });
  await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
  await app.register(nodeRoutes, { prefix: "/api/clusters" });
  await app.register(guestRoutes, { prefix: "/api/clusters" });
  await app.register(taskRoutes, { prefix: "/api/clusters" });
  await app.register(storageRoutes, { prefix: "/api/clusters" });
  await app.register(networkRoutes, { prefix: "/api/clusters" });
  await app.register(backupRoutes, { prefix: "/api/clusters" });
  await app.register(auditRoutes, { prefix: "/api/audit" });
  await app.register(consoleRoutes, { prefix: "/api/clusters" });

  app.get("/api/health", async () => ({ ok: true }));

  // wildcard defaults to true so files are resolved per-request rather than enumerated once at
  // boot — otherwise a rebuilt SPA (new hashed filenames) would 404 until the server restarts.
  const webDist = path.resolve(__dirname, "../../web/dist");
  await app.register(staticPlugin, { root: webDist });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  return app;
}
