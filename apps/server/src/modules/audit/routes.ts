import type { FastifyInstance } from "fastify";
import { listAuditLog } from "../../db/repositories/auditLog.js";
import { requireSession, requireAppAdmin } from "../common.js";

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);
  fastify.addHook("preHandler", requireAppAdmin);

  fastify.get("/", async (_request, reply) => {
    return reply.send(listAuditLog());
  });
}
