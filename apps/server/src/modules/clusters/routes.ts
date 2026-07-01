import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CreateClusterInputSchema } from "@proxmox-ui/shared";
import { probeCertificate } from "@proxmox-ui/proxmox-client";
import { createCluster, deleteCluster, listClusters } from "../../db/repositories/clusters.js";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { isAppAdmin } from "../../security/appAdmin.js";
import { canBootstrapWithSetupToken } from "../../security/appAdmin.js";

const ProbeInputSchema = z.object({ host: z.string().min(1), port: z.number().int().min(1).max(65535).default(8006) });

function isAuthorizedToManage(request: { session: import("../../security/sessionStore.js").SessionData | null; headers: Record<string, unknown> }): boolean {
  const setupHeader = request.headers["x-setup-token"];
  if (typeof setupHeader === "string" && canBootstrapWithSetupToken(setupHeader)) return true;
  const user = request.session?.primaryUser;
  return !!user && isAppAdmin(user.username, user.realm);
}

export default async function clusterRoutes(fastify: FastifyInstance) {
  // Public (unauthenticated) list so the login screen can offer a cluster picker.
  // Only non-sensitive fields are returned — the pinned TLS fingerprint never leaves the server.
  fastify.get("/", async (_request, reply) => {
    const clusters = listClusters().map(({ tlsFingerprint: _tlsFingerprint, ...rest }) => rest);
    return reply.send(clusters);
  });

  fastify.post("/probe", async (request, reply) => {
    if (!isAuthorizedToManage(request)) {
      return reply.code(403).send({ error: "Requires app-admin privileges" });
    }
    const parsed = ProbeInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request" });
    try {
      const result = await probeCertificate(parsed.data.host, parsed.data.port);
      return reply.send({ host: parsed.data.host, port: parsed.data.port, ...result });
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : "Probe failed" });
    }
  });

  fastify.post("/", async (request, reply) => {
    if (!isAuthorizedToManage(request)) {
      return reply.code(403).send({ error: "Requires app-admin privileges" });
    }
    const parsed = CreateClusterInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });

    const cluster = createCluster(parsed.data);
    recordAudit({
      clusterId: cluster.id,
      proxmoxUser: request.session?.primaryUser
        ? `${request.session.primaryUser.username}@${request.session.primaryUser.realm}`
        : "setup-token",
      action: "cluster.register",
      target: cluster.host,
      result: "success",
    });
    const { tlsFingerprint: _tlsFingerprint, ...safe } = cluster;
    return reply.code(201).send(safe);
  });

  fastify.delete("/:id", async (request, reply) => {
    if (!isAuthorizedToManage(request)) {
      return reply.code(403).send({ error: "Requires app-admin privileges" });
    }
    const { id } = request.params as { id: string };
    deleteCluster(id);
    recordAudit({
      clusterId: id,
      proxmoxUser: request.session?.primaryUser
        ? `${request.session.primaryUser.username}@${request.session.primaryUser.realm}`
        : "setup-token",
      action: "cluster.remove",
      target: id,
      result: "success",
    });
    return reply.code(204).send();
  });
}
