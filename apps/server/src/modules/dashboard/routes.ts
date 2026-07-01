import type { FastifyInstance } from "fastify";
import type { ClusterResource } from "@proxmox-ui/shared";
import { getCluster, listClusters } from "../../db/repositories/clusters.js";
import { getClientForSession } from "../../security/connectionManager.js";
import { requireSession } from "../common.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  /** Aggregates /cluster/resources across every cluster this session is currently authenticated to. */
  fastify.get("/resources", async (request, reply) => {
    const session = request.session!;
    const results: ClusterResource[] = [];
    const errors: Record<string, string> = {};

    await Promise.all(
      Object.keys(session.clusters).map(async (clusterId) => {
        const cluster = getCluster(clusterId);
        if (!cluster) return;
        try {
          const client = getClientForSession(session, clusterId);
          const raw = await client.getClusterResources();
          for (const r of raw) {
            results.push({
              clusterId,
              clusterName: cluster.name,
              id: r.id,
              type: r.type as ClusterResource["type"],
              node: r.node,
              vmid: r.vmid,
              name: r.name,
              status: r.status,
              uptime: r.uptime,
              cpu: r.cpu,
              maxcpu: r.maxcpu,
              mem: r.mem,
              maxmem: r.maxmem,
              disk: r.disk,
              maxdisk: r.maxdisk,
              tags: r.tags,
              template: r.template,
            });
          }
        } catch (err) {
          errors[clusterId] = err instanceof Error ? err.message : "Unknown error";
        }
      }),
    );

    return reply.send({ resources: results, errors });
  });

  /** Quorum/node-count health for every cluster this session is authenticated to. */
  fastify.get("/cluster-status", async (request, reply) => {
    const session = request.session!;
    const results: Array<{
      clusterId: string;
      clusterName: string;
      quorate: boolean;
      nodeCount: number;
      onlineNodeCount: number;
    }> = [];

    await Promise.all(
      Object.keys(session.clusters).map(async (clusterId) => {
        const cluster = getCluster(clusterId);
        if (!cluster) return;
        try {
          const client = getClientForSession(session, clusterId);
          const raw = await client.getClusterStatus();
          const clusterEntry = raw.find((r) => r.type === "cluster");
          const nodeEntries = raw.filter((r) => r.type === "node");
          results.push({
            clusterId,
            clusterName: cluster.name,
            quorate: clusterEntry ? clusterEntry.quorate === 1 : true,
            nodeCount: nodeEntries.length,
            onlineNodeCount: nodeEntries.filter((n) => n.online === 1).length,
          });
        } catch {
          // Skip clusters we can't reach right now; /resources already surfaces the error banner.
        }
      }),
    );

    return reply.send(results);
  });

  fastify.get("/clusters", async (request, reply) => {
    const session = request.session!;
    const all = listClusters();
    return reply.send(
      all.map((c) => ({
        id: c.id,
        name: c.name,
        host: c.host,
        connected: Boolean(session.clusters[c.id]),
      })),
    );
  });
}
