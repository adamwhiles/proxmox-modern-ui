import type { Dispatcher } from "undici";
import { ProxmoxClient, createPinnedAgent } from "@proxmox-ui/proxmox-client";
import { getCluster } from "../db/repositories/clusters.js";
import type { SessionData } from "./sessionStore.js";

const agentCache = new Map<string, Dispatcher>();

function getSharedAgent(clusterId: string, tlsFingerprint: string): Dispatcher {
  const key = `${clusterId}:${tlsFingerprint}`;
  let agent = agentCache.get(key);
  if (!agent) {
    agent = createPinnedAgent(tlsFingerprint);
    agentCache.set(key, agent);
  }
  return agent;
}

export class ClusterNotConnectedError extends Error {
  constructor(clusterId: string) {
    super(`Session is not authenticated to cluster ${clusterId}`);
    this.name = "ClusterNotConnectedError";
  }
}

/**
 * Builds a ProxmoxClient for one cluster using the ticket stashed in this browser session.
 * The underlying TLS agent is cached per cluster (safe — it holds no per-user secrets),
 * but the ticket itself is scoped to this request only, never shared across sessions.
 */
export function getClientForSession(session: SessionData, clusterId: string): ProxmoxClient {
  const cluster = getCluster(clusterId);
  if (!cluster) throw new Error(`Unknown cluster ${clusterId}`);
  const entry = session.clusters[clusterId];
  if (!entry) throw new ClusterNotConnectedError(clusterId);

  const client = new ProxmoxClient({
    host: cluster.host,
    port: cluster.port,
    tlsFingerprint: cluster.tlsFingerprint,
    dispatcher: getSharedAgent(cluster.id, cluster.tlsFingerprint),
  });
  client.restoreTicket(entry.ticket);
  return client;
}
