import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "../config.js";

export default fp(async function securityPlugin(fastify: FastifyInstance) {
  await fastify.register(helmet, {
    // Strict CSP: the SPA is same-origin and needs no third-party script/style/connect sources.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind/shadcn inject some inline styles
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "wss:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: config.isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false, // noVNC/xterm.js websockets don't need COEP
  });

  if (config.corsOrigin) {
    await fastify.register(cors, { origin: config.corsOrigin, credentials: true });
  }
  // If corsOrigin is unset (recommended default), we register no CORS policy at all: the browser's
  // same-origin policy plus our CSRF check is the intended posture for a same-origin SPA+API deploy.

  await fastify.register(rateLimit, {
    global: false, // applied selectively (e.g. login) rather than every route
  });
});
