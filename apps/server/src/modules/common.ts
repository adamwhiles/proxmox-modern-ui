import type { FastifyReply, FastifyRequest } from "fastify";
import type { ProxmoxClient } from "@proxmox-ui/proxmox-client";
import { isAppAdmin } from "../security/appAdmin.js";
import { ClusterNotConnectedError, getClientForSession } from "../security/connectionManager.js";

export async function requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.session) {
    reply.code(401).send({ error: "Not authenticated" });
  }
}

export async function requireAppAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.session?.primaryUser;
  if (!user || !isAppAdmin(user.username, user.realm)) {
    reply.code(403).send({ error: "Requires app-admin privileges" });
  }
}

export function requireClusterConnection(
  request: FastifyRequest,
  clusterId: string,
): { username: string } | null {
  const entry = request.session?.clusters[clusterId];
  if (!entry) return null;
  return { username: entry.ticket.username };
}

/** Resolves a connected ProxmoxClient for :clusterId, or writes the appropriate error response and returns null. */
export function resolveClient(request: FastifyRequest, reply: FastifyReply, clusterId: string): ProxmoxClient | null {
  if (!request.session) {
    reply.code(401).send({ error: "Not authenticated" });
    return null;
  }
  try {
    return getClientForSession(request.session, clusterId);
  } catch (err) {
    if (err instanceof ClusterNotConnectedError) {
      reply.code(409).send({ error: err.message });
      return null;
    }
    reply.code(404).send({ error: err instanceof Error ? err.message : "Unknown cluster" });
    return null;
  }
}

function currentUser(request: FastifyRequest): string {
  const u = request.session?.primaryUser;
  return u ? `${u.username}@${u.realm}` : "unknown";
}
export { currentUser };

export async function handleRouteError(
  reply: FastifyReply,
  err: unknown,
  fallbackStatus = 500,
): Promise<void> {
  if (err instanceof ClusterNotConnectedError) {
    reply.code(409).send({ error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  // Never leak upstream Proxmox error internals verbatim to avoid information disclosure beyond
  // what the operator needs; the message from ProxmoxApiError is already safe/generic enough here.
  reply.code(fallbackStatus).send({ error: message });
}
