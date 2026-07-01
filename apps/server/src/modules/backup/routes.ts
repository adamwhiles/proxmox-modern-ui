import type { FastifyInstance } from "fastify";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { requireSession, resolveClient, handleRouteError, currentUser } from "../common.js";

export default async function backupRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  fastify.get<{ Params: { clusterId: string } }>("/:clusterId/backup-jobs", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      return reply.send(await client.listBackupJobs());
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post<{
    Params: { clusterId: string; node: string };
    Body: { vmid: number; storage: string; mode?: "snapshot" | "suspend" | "stop"; compress?: string };
  }>("/:clusterId/nodes/:node/vzdump", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      const upid = await client.createVzdump(request.params.node, request.body);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "backup.create",
        target: `${request.params.node}/${request.body.vmid}`,
        upid,
        result: "success",
      });
      return reply.code(201).send({ upid });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
