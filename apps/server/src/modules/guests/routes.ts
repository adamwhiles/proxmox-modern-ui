import type { FastifyInstance } from "fastify";
import {
  GuestActionSchema,
  CreateQemuInputSchema,
  CreateLxcInputSchema,
  UpdateQemuConfigInputSchema,
  UpdateLxcConfigInputSchema,
} from "@proxmox-ui/shared";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { requireSession, resolveClient, handleRouteError, currentUser } from "../common.js";

type GuestType = "qemu" | "lxc";

export default async function guestRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireSession);

  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type } = request.params;
      try {
        const list = type === "qemu" ? await client.listQemu(node) : await client.listLxc(node);
        return reply.send(list);
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/config",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid } = request.params;
      try {
        return reply.send(await client.getGuestConfig(type, node, Number(vmid)));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.put<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/config",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node, type, vmid } = request.params;

      const schema = type === "qemu" ? UpdateQemuConfigInputSchema : UpdateLxcConfigInputSchema;
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });

      try {
        if (type === "qemu") {
          const input = parsed.data as import("@proxmox-ui/shared").UpdateQemuConfigInput;
          const { diskResizeGiB, diskKey, ...rest } = input;
          const params: Record<string, string | number | boolean> = {};
          if (rest.name !== undefined) params.name = rest.name;
          if (rest.cores !== undefined) params.cores = rest.cores;
          if (rest.sockets !== undefined) params.sockets = rest.sockets;
          if (rest.cpuType !== undefined) params.cpu = rest.cpuType;
          if (rest.memoryMiB !== undefined) params.memory = rest.memoryMiB;
          if (rest.balloonMiB !== undefined) params.balloon = rest.balloonMiB;
          if (rest.qemuAgent !== undefined) params.agent = rest.qemuAgent ? 1 : 0;
          if (rest.onboot !== undefined) params.onboot = rest.onboot ? 1 : 0;
          if (rest.tags !== undefined) params.tags = rest.tags;

          if (Object.keys(params).length > 0) await client.updateGuestConfig(type, node, Number(vmid), params);
          if (diskResizeGiB) await client.resizeDisk(type, node, Number(vmid), diskKey ?? "scsi0", diskResizeGiB);
        } else {
          const input = parsed.data as import("@proxmox-ui/shared").UpdateLxcConfigInput;
          const { diskResizeGiB, ...rest } = input;
          const params: Record<string, string | number | boolean> = {};
          if (rest.hostname !== undefined) params.hostname = rest.hostname;
          if (rest.cores !== undefined) params.cores = rest.cores;
          if (rest.memoryMiB !== undefined) params.memory = rest.memoryMiB;
          if (rest.swapMiB !== undefined) params.swap = rest.swapMiB;
          if (rest.onboot !== undefined) params.onboot = rest.onboot ? 1 : 0;

          if (Object.keys(params).length > 0) await client.updateGuestConfig(type, node, Number(vmid), params);
          if (diskResizeGiB) await client.resizeDisk(type, node, Number(vmid), "rootfs", diskResizeGiB);
        }

        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "guest.config.update",
          target: `${type}/${node}/${vmid}`,
          result: "success",
        });
        return reply.send({ ok: true });
      } catch (err) {
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "guest.config.update",
          target: `${type}/${node}/${vmid}`,
          result: "failure",
          detail: err instanceof Error ? err.message : undefined,
        });
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string }; Querystring: { timeframe?: "hour" | "day" | "week" | "month" | "year" } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/rrddata",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid } = request.params;
      try {
        return reply.send(await client.getGuestRrdData(type, node, Number(vmid), request.query.timeframe));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/action",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const parsed = GuestActionSchema.safeParse((request.body as { action?: unknown })?.action);
      if (!parsed.success) return reply.code(400).send({ error: "Invalid action" });

      const { clusterId, node, type, vmid } = request.params;
      try {
        const upid = await client.guestAction(type, node, Number(vmid), parsed.data);
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: `guest.${parsed.data}`,
          target: `${type}/${node}/${vmid}`,
          upid,
          result: "success",
        });
        return reply.send({ upid });
      } catch (err) {
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: `guest.${parsed.data}`,
          target: `${type}/${node}/${vmid}`,
          result: "failure",
          detail: err instanceof Error ? err.message : undefined,
        });
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.delete<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { clusterId, node, type, vmid } = request.params;
      try {
        const upid = await client.deleteGuest(type, node, Number(vmid));
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: "guest.delete",
          target: `${type}/${node}/${vmid}`,
          upid,
          result: "success",
        });
        return reply.send({ upid });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string }; Body: { newid: number; name?: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/clone",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid } = request.params;
      const { newid, name } = request.body;
      try {
        const upid = await client.cloneGuest(type, node, Number(vmid), newid, name);
        return reply.send({ upid });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string } }>("/:clusterId/nodes/:node/qemu", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    const parsed = CreateQemuInputSchema.safeParse({ ...(request.body as object), clusterId: request.params.clusterId });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    try {
      const upid = await client.createQemu(parsed.data);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "guest.create.qemu",
        target: `${parsed.data.node}/${parsed.data.vmid}`,
        upid,
        result: "success",
      });
      return reply.code(201).send({ upid });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  fastify.post<{ Params: { clusterId: string } }>("/:clusterId/nodes/:node/lxc", async (request, reply) => {
    const client = resolveClient(request, reply, request.params.clusterId);
    if (!client) return;
    const parsed = CreateLxcInputSchema.safeParse({ ...(request.body as object), clusterId: request.params.clusterId });
    if (!parsed.success) return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    try {
      const upid = await client.createLxc(parsed.data);
      recordAudit({
        clusterId: request.params.clusterId,
        proxmoxUser: currentUser(request),
        action: "guest.create.lxc",
        target: `${parsed.data.node}/${parsed.data.vmid}`,
        upid,
        result: "success",
      });
      return reply.code(201).send({ upid });
    } catch (err) {
      return handleRouteError(reply, err);
    }
  });

  // -- snapshots --
  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/snapshots",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid } = request.params;
      try {
        return reply.send(await client.listSnapshots(type, node, Number(vmid)));
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string }; Body: { name: string; description?: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/snapshots",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid } = request.params;
      try {
        const upid = await client.createSnapshot(type, node, Number(vmid), request.body.name, request.body.description);
        return reply.code(201).send({ upid });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.delete<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string; name: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/snapshots/:name",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid, name } = request.params;
      try {
        const upid = await client.deleteSnapshot(type, node, Number(vmid), name);
        return reply.send({ upid });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );

  fastify.post<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string; name: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/snapshots/:name/rollback",
    async (request, reply) => {
      const client = resolveClient(request, reply, request.params.clusterId);
      if (!client) return;
      const { node, type, vmid, name } = request.params;
      try {
        const upid = await client.rollbackSnapshot(type, node, Number(vmid), name);
        return reply.send({ upid });
      } catch (err) {
        return handleRouteError(reply, err);
      }
    },
  );
}
