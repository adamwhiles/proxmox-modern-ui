import type { FastifyInstance } from "fastify";
import { CreateStorageInputSchema, UpdateStorageInputSchema, DownloadUrlInputSchema } from "@proxmox-ui/shared";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { requireSession, resolveClient, handleRouteError, currentUser } from "../common.js";

export default async function storageRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  fastify.get<{ Params: { clusterId: string; node: string } }>(
    "/:clusterId/nodes/:node/storage",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(await client.listNodeStorage(request.params.node));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string; node: string; storage: string }; Querystring: { content?: string } }>(
    "/:clusterId/nodes/:node/storage/:storage/content",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        return reply.send(
          await client.listStorageContent(request.params.node, request.params.storage, request.query.content),
        );
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.delete<{ Params: { clusterId: string; node: string; storage: string; volid: string } }>(
    "/:clusterId/nodes/:node/storage/:storage/content/:volid",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node, storage, volid } = request.params;
      try {
        const decoded = decodeURIComponent(volid);
        await client.deleteStorageContent(node, storage, decoded);
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "storage.content.delete",
          target: `${storage}/${decoded}`,
          result: "success",
        });
        return reply.send({ ok: true });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string; storage: string } }>(
    "/:clusterId/nodes/:node/storage/:storage/download-url",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node, storage } = request.params;
      const parsed = DownloadUrlInputSchema.safeParse({ ...(request.body as object), clusterId, node, storage });
      if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      try {
        const upid = await client.downloadUrl(parsed.data);
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "storage.download",
          target: `${storage}/${parsed.data.filename}`,
          upid,
          result: "success",
        });
        return reply.code(201).send({ upid });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  // -- cluster-wide storage configuration (storage.cfg) --

  fastify.get<{ Params: { clusterId: string } }>("/:clusterId/storage", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    try {
      return reply.send(await client.listClusterStorage());
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post<{ Params: { clusterId: string } }>("/:clusterId/storage", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    const parsed = CreateStorageInputSchema.safeParse({ ...(request.body as object), clusterId: request.params.clusterId });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    try {
      await client.createStorage(parsed.data);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "storage.create",
        target: parsed.data.storageId,
        result: "success",
      });
      return reply.code(201).send({ ok: true });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.put<{ Params: { clusterId: string; storageId: string } }>(
    "/:clusterId/storage/:storageId",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const parsed = UpdateStorageInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      try {
        await client.updateStorage(request.params.storageId, parsed.data);
        recordAudit({
          clusterId: request.params.clusterId,
          proxmoxUser: currentUser(request),
          action: "storage.update",
          target: request.params.storageId,
          result: "success",
        });
        return reply.send({ ok: true });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.delete<{ Params: { clusterId: string; storageId: string } }>(
    "/:clusterId/storage/:storageId",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      try {
        await client.deleteStorage(request.params.storageId);
        recordAudit({
          clusterId: request.params.clusterId,
          proxmoxUser: currentUser(request),
          action: "storage.delete",
          target: request.params.storageId,
          result: "success",
        });
        return reply.code(204).send();
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );
}
