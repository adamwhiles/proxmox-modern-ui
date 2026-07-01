import type { FastifyInstance } from "fastify";
import { requireSession, resolveClient, handleRouteError } from "../common.js";

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  fastify.get<{ Params: { clusterId: string; node: string; upid: string } }>(
    "/:clusterId/nodes/:node/tasks/:upid",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(await client.getTaskStatus(request.params.node, request.params.upid));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string; node: string; upid: string } }>(
    "/:clusterId/nodes/:node/tasks/:upid/log",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(await client.getTaskLog(request.params.node, request.params.upid));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string } }>("/:clusterId/tasks", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      return reply.send(await client.listClusterTasks());
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
