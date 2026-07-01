import type { FastifyInstance } from "fastify";
import { LoginInputSchema } from "@proxmox-ui/shared";
import { ProxmoxClient, ProxmoxAuthError } from "@proxmox-ui/proxmox-client";
import { getCluster } from "../../db/repositories/clusters.js";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { isAppAdmin } from "../../security/appAdmin.js";
import type { SessionData } from "../../security/sessionStore.js";

export default async function authRoutes(fastify: FastifyInstance) {
  // Deliberately strict rate limit: this is the one endpoint that accepts a password guess.
  fastify.post(
    "/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = LoginInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request" });
      }
      const { clusterId, username, password, realm, otp } = parsed.data;

      const cluster = getCluster(clusterId);
      if (!cluster) {
        return reply.code(404).send({ error: "Unknown cluster" });
      }

      const client = new ProxmoxClient({
        host: cluster.host,
        port: cluster.port,
        tlsFingerprint: cluster.tlsFingerprint,
      });

      try {
        const ticket = await client.login(username, password, realm, otp);
        const existing = request.session;

        const nextClusters: SessionData["clusters"] = {
          ...(existing?.clusters ?? {}),
          [clusterId]: { ticket },
        };
        const primaryUser = existing?.primaryUser ?? { username, realm };

        if (existing && request.sessionId) {
          reply.saveSession({ ...existing, clusters: nextClusters, primaryUser });
        } else {
          reply.startSession({ clusters: nextClusters, primaryUser });
        }

        recordAudit({
          clusterId,
          proxmoxUser: `${username}@${realm}`,
          action: "auth.login",
          result: "success",
        });

        return reply.send({
          username: `${username}@${realm}`,
          realm,
          isAppAdmin: isAppAdmin(username, realm),
        });
      } catch (err) {
        recordAudit({
          clusterId,
          proxmoxUser: `${username}@${realm}`,
          action: "auth.login",
          result: "failure",
        });
        if (err instanceof ProxmoxAuthError) {
          // Deliberately generic — never confirm whether the username or cluster reachability was the issue.
          return reply.code(401).send({ error: "Invalid credentials" });
        }
        return reply.code(502).send({ error: "Unable to reach Proxmox cluster" });
      }
    },
  );

  fastify.post("/logout", async (request, reply) => {
    if (request.session?.primaryUser) {
      recordAudit({
        clusterId: null,
        proxmoxUser: `${request.session.primaryUser.username}@${request.session.primaryUser.realm}`,
        action: "auth.logout",
        result: "success",
      });
    }
    reply.endSession();
    return reply.send({ ok: true });
  });

  fastify.get("/me", async (request, reply) => {
    if (!request.session?.primaryUser) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    const { username, realm } = request.session.primaryUser;
    return reply.send({
      username: `${username}@${realm}`,
      realm,
      isAppAdmin: isAppAdmin(username, realm),
      connectedClusters: Object.keys(request.session.clusters),
    });
  });
}
