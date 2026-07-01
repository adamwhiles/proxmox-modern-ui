import type { FastifyInstance } from "fastify";
import { requireSession, resolveClient, handleRouteError } from "../common.js";

export default async function nodeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  fastify.get<{ Params: { clusterId: string } }>("/:clusterId/nodes", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      return reply.send(await client.listNodes());
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.get<{ Params: { clusterId: string; node: string } }>(
    "/:clusterId/nodes/:node/status",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(await client.getNodeStatus(request.params.node));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string; node: string }; Querystring: { timeframe?: "hour" | "day" | "week" | "month" | "year" } }>(
    "/:clusterId/nodes/:node/rrddata",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(await client.getNodeRrdData(request.params.node, request.query.timeframe));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );
}
