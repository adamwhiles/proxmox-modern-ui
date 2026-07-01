import type { FastifyInstance } from "fastify";
import { CreateNetworkInterfaceInputSchema, CreateSdnZoneInputSchema, CreateSdnVnetInputSchema } from "@proxmox-ui/shared";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { requireSession, resolveClient, handleRouteError, currentUser } from "../common.js";

export default async function networkRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  fastify.get<{ Params: { clusterId: string; node: string } }>(
    "/:clusterId/nodes/:node/network",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(await client.listNodeNetwork(request.params.node));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string } }>(
    "/:clusterId/nodes/:node/network",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node } = request.params;
      const parsed = CreateNetworkInterfaceInputSchema.safeParse({ ...(request.body as object), clusterId, node });
      if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      try {
        await client.createNetworkInterface(parsed.data);
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "network.interface.create",
          target: `${node}/${parsed.data.iface}`,
          result: "success",
        });
        return reply.code(201).send({ ok: true });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.put<{ Params: { clusterId: string; node: string; iface: string } }>(
    "/:clusterId/nodes/:node/network/:iface",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node, iface } = request.params;
      try {
        await client.updateNetworkInterface({ clusterId, node, iface, ...(request.body as object) });
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "network.interface.update",
          target: `${node}/${iface}`,
          result: "success",
        });
        return reply.send({ ok: true });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.delete<{ Params: { clusterId: string; node: string; iface: string } }>(
    "/:clusterId/nodes/:node/network/:iface",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node, iface } = request.params;
      try {
        await client.deleteNetworkInterface(node, iface);
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "network.interface.delete",
          target: `${node}/${iface}`,
          result: "success",
        });
        return reply.send({ ok: true });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string } }>(
    "/:clusterId/nodes/:node/network/apply",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node } = request.params;
      try {
        await client.applyNetworkConfig(node);
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "network.apply",
          target: node,
          result: "success",
        });
        return reply.send({ ok: true });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string } }>("/:clusterId/sdn/zones", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      return reply.send(await client.listSdnZones());
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post<{ Params: { clusterId: string } }>("/:clusterId/sdn/zones", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    const parsed = CreateSdnZoneInputSchema.safeParse({ ...(request.body as object), clusterId: request.params.clusterId });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    try {
      await client.createSdnZone(parsed.data);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "sdn.zone.create",
        target: parsed.data.zone,
        result: "success",
      });
      return reply.code(201).send({ ok: true });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.delete<{ Params: { clusterId: string; zone: string } }>("/:clusterId/sdn/zones/:zone", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      await client.deleteSdnZone(request.params.zone);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "sdn.zone.delete",
        target: request.params.zone,
        result: "success",
      });
      return reply.send({ ok: true });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.get<{ Params: { clusterId: string } }>("/:clusterId/sdn/vnets", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      return reply.send(await client.listSdnVnets());
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post<{ Params: { clusterId: string } }>("/:clusterId/sdn/vnets", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    const parsed = CreateSdnVnetInputSchema.safeParse({ ...(request.body as object), clusterId: request.params.clusterId });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    try {
      await client.createSdnVnet(parsed.data);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "sdn.vnet.create",
        target: parsed.data.vnet,
        result: "success",
      });
      return reply.code(201).send({ ok: true });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.delete<{ Params: { clusterId: string; vnet: string } }>("/:clusterId/sdn/vnets/:vnet", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      await client.deleteSdnVnet(request.params.vnet);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "sdn.vnet.delete",
        target: request.params.vnet,
        result: "success",
      });
      return reply.send({ ok: true });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post<{ Params: { clusterId: string } }>("/:clusterId/sdn/apply", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      await client.applySdnConfig();
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "sdn.apply",
        target: null,
        result: "success",
      });
      return reply.send({ ok: true });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });
}
