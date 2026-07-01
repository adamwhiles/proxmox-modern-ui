import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { getCluster } from "../../db/repositories/clusters.js";
import { getClientForSession } from "../../security/connectionManager.js";
import { PinnedHttpsAgent } from "../../security/pinnedHttpsAgent.js";
import { recordAudit } from "../../db/repositories/auditLog.js";
import { currentUser } from "../common.js";

type GuestType = "qemu" | "lxc";
type ConsoleKind = "vnc" | "shell";

/**
 * Bridges a browser websocket to Proxmox's own vncwebsocket endpoint. The browser only ever holds
 * an app-authenticated websocket to us; the Proxmox VNC ticket and cookie stay server-side.
 *
 * Shell consoles (kind=shell -> termproxy) require a real user ticket — Proxmox rejects API tokens
 * for /termproxy — which is exactly why this project uses delegated login auth (see auth/routes.ts).
 */
export default async function consoleRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string; kind: ConsoleKind } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/console/:kind(vnc|shell)",
    { websocket: true },
    async (socket, request) => {
      const { clusterId, node, type, vmid, kind } = request.params;
      const fail = (reason: string) => {
        socket.close(4001, reason);
      };

      if (!request.session) return fail("Not authenticated");
      const cluster = getCluster(clusterId);
      if (!cluster) return fail("Unknown cluster");

      let client;
      try {
        client = getClientForSession(request.session, clusterId);
      } catch {
        return fail("Not connected to cluster");
      }

      try {
        const proxmoxTicket =
          kind === "vnc"
            ? await client.getVncProxyTicket(type, node, Number(vmid))
            : await client.getTermProxyTicket(type, node, Number(vmid));

        const wsUrl = client.buildConsoleWebsocketUrl(node, type, Number(vmid), proxmoxTicket.port, proxmoxTicket.ticket);
        const ticket = client.getTicket();

        // Proxmox's pveproxy rejects the vncwebsocket upgrade unless the client negotiates the
        // "binary" subprotocol (this is what the stock Proxmox UI's own websocket client sends) —
        // passing protocols as the 2nd arg (not folded into options) is required to send it.
        const upstream = new WebSocket(wsUrl, ["binary"], {
          agent: new PinnedHttpsAgent(cluster.tlsFingerprint),
          headers: {
            Cookie: `PVEAuthCookie=${ticket?.ticket ?? ""}`,
            Referer: `https://${cluster.host}:${cluster.port}/`,
          },
        });

        upstream.on("unexpected-response", (_req, res) => {
          let errBody = "";
          res.on("data", (chunk) => (errBody += chunk));
          res.on("end", () => {
            request.log.error({ statusCode: res.statusCode, errBody }, "console upstream rejected upgrade");
            fail(`Proxmox rejected the console connection (HTTP ${res.statusCode})`);
          });
        });

        upstream.on("open", () => {
          recordAudit({
            clusterId,
            proxmoxUser: currentUser(request),
            action: `console.${kind}.open`,
            target: `${type}/${node}/${vmid}`,
            result: "success",
          });
        });

        // Relay in both directions; either side closing tears down the other.
        upstream.on("message", (data) => {
          if (socket.readyState === socket.OPEN) socket.send(data);
        });
        socket.on("message", (data) => {
          if (upstream.readyState === upstream.OPEN) upstream.send(data);
        });

        upstream.on("close", (code, reason) => {
          const reasonText = reason?.toString() ?? "";
          request.log.info({ code, reason: reasonText }, "console upstream closed");
          // 1006 is reserved (never sent explicitly) and several other codes are invalid to relay
          // verbatim, so we always close the downstream socket with a normal/app code and put the
          // real upstream code in the reason text for diagnosability.
          const relayCode = code === 1000 ? 1000 : 1011;
          socket.close(relayCode, `upstream closed (code ${code}${reasonText ? `: ${reasonText}` : ""})`.slice(0, 123));
        });
        socket.on("close", () => upstream.close());
        upstream.on("error", (err) => {
          request.log.error({ err }, "console upstream error");
          socket.close(1011, "Upstream console error");
        });
        socket.on("error", () => upstream.close());
      } catch (err) {
        request.log.error({ err }, "console setup failed");
        recordAudit({
          clusterId,
          proxmoxUser: currentUser(request),
          action: `console.${kind}.open`,
          target: `${type}/${node}/${vmid}`,
          result: "failure",
          detail: err instanceof Error ? err.message : undefined,
        });
        fail(err instanceof Error ? err.message : "Console setup failed");
      }
    },
  );
}
