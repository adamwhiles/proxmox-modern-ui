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
 * Real Proxmox VNC displays require classic "VNC Authentication" using the vncproxy ticket as the
 * password — the browser's noVNC client must answer that challenge itself (we can't do it for it
 * without reimplementing the DES challenge server-side), so the raw ticket has to reach the
 * frontend. It must be the SAME ticket used for the tunnel below (each /vncproxy call mints a new
 * port+ticket pair), so the frontend fetches it once via GET .../console/vnc-ticket and this route
 * stashes it here for the subsequent websocket upgrade to consume. Short TTL, single use.
 */
const pendingVncTickets = new Map<string, { port: string; ticket: string; expiresAt: number }>();

function vncTicketKey(sessionId: string, clusterId: string, node: string, type: GuestType, vmid: string) {
  return `${sessionId}:${clusterId}:${node}:${type}:${vmid}`;
}

/**
 * Bridges a browser websocket to Proxmox's own vncwebsocket endpoint. The browser only ever holds
 * an app-authenticated websocket to us; the Proxmox VNC ticket and cookie stay server-side.
 *
 * Shell consoles (kind=shell -> termproxy) require a real user ticket — Proxmox rejects API tokens
 * for /termproxy — which is exactly why this project uses delegated login auth (see auth/routes.ts).
 */
export default async function consoleRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/console/vnc-ticket",
    async (request, reply) => {
      const { clusterId, node, type, vmid } = request.params;
      if (!request.session || !request.sessionId) return reply.code(401).send({ error: "Not authenticated" });
      let client;
      try {
        client = getClientForSession(request.session, clusterId);
      } catch {
        return reply.code(409).send({ error: "Not connected to cluster" });
      }
      const proxmoxTicket = await client.getVncProxyTicket(type, node, Number(vmid));
      pendingVncTickets.set(vncTicketKey(request.sessionId, clusterId, node, type, vmid), {
        port: proxmoxTicket.port,
        ticket: proxmoxTicket.ticket,
        expiresAt: Date.now() + 30_000,
      });
      return reply.send({ ticket: proxmoxTicket.ticket });
    },
  );

  fastify.get<{ Params: { clusterId: string; node: string; type: GuestType; vmid: string; kind: ConsoleKind } }>(
    "/:clusterId/nodes/:node/:type(qemu|lxc)/:vmid/console/:kind(vnc|shell)",
    { websocket: true },
    async (socket, request) => {
      const { clusterId, node, type, vmid, kind } = request.params;
      const fail = (reason: string) => {
        socket.close(4001, reason);
      };

      if (!request.session || !request.sessionId) return fail("Not authenticated");
      const cluster = getCluster(clusterId);
      if (!cluster) return fail("Unknown cluster");

      let client;
      try {
        client = getClientForSession(request.session, clusterId);
      } catch {
        return fail("Not connected to cluster");
      }

      // Attach this BEFORE any `await` below — the browser sends its first message (a resize, for
      // shell sessions) as soon as its socket opens, which can race ahead of the ticket fetch and
      // upstream connection setup. An EventEmitter drops events with no listener attached at the
      // time they fire, so registering this late silently ate the client's first message, and
      // Proxmox's termproxy then times out waiting for input that already came and went.
      //
      // `ws` always delivers message payloads as Buffers regardless of the original frame type —
      // the *only* place the text-vs-binary distinction survives is the `isBinary` flag on the
      // 'message' event. `.send(buffer)` defaults to a BINARY frame, so relaying without passing
      // `{ binary: isBinary }` silently turns every TEXT frame (the termproxy line protocol xterm.js
      // uses) into a BINARY one. Proxmox's termproxy never recognizes it as valid input, waits the
      // full 10s for a client it never really heard from, and exits — which is exactly the abrupt
      // 1006 close seen here.
      let upstreamRef: WebSocket | null = null;
      const bufferedFromClient: { data: Buffer; isBinary: boolean }[] = [];
      socket.on("message", (data: Buffer, isBinary: boolean) => {
        if (upstreamRef?.readyState === WebSocket.OPEN) {
          upstreamRef.send(data, { binary: isBinary });
        } else {
          bufferedFromClient.push({ data, isBinary });
        }
      });

      try {
        let proxmoxTicket;
        if (kind === "vnc") {
          const key = vncTicketKey(request.sessionId, clusterId, node, type, vmid);
          const pending = pendingVncTickets.get(key);
          pendingVncTickets.delete(key);
          if (!pending || pending.expiresAt < Date.now()) {
            return fail("VNC ticket expired or missing — reopen the console tab to retry");
          }
          proxmoxTicket = pending;
        } else {
          proxmoxTicket = await client.getTermProxyTicket(type, node, Number(vmid));
        }

        const wsUrl = client.buildConsoleWebsocketUrl(node, type, Number(vmid), proxmoxTicket.port, proxmoxTicket.ticket);
        const ticket = client.getTicket();
        // termproxy itself (not just pveproxy) requires authenticating over the tunnel: the very
        // first message on the socket must be "user@realm:vncticket\n" as TEXT, and the server
        // replies with a 2-byte "OK" prefix (see pve-xtermjs's xterm.js/src/main.js) before any real
        // terminal I/O flows. Without this, pveproxy happily bridges to termproxy's local port, but
        // termproxy's read_ticket_line() never receives a ticket line and times out after 10s — which
        // is exactly the failure mode confirmed by `ss` showing the bridge connection sitting
        // established and idle for ~10s. VNC sessions don't need this (noVNC's own RFB challenge
        // handles auth), so this only applies to kind === "shell".
        let awaitingShellAuthAck = kind === "shell";
        // Real Proxmox loads its console in an iframe at this same URL, so both the ticket request
        // AND the websocket upgrade carry this Referer — sending a plainer one here (as we used to)
        // is a mismatch from what pveproxy actually sees from its own UI.
        const referer = client.buildConsoleReferer(node, type, Number(vmid), kind === "vnc" ? "novnc" : "xtermjs");

        // Proxmox's pveproxy rejects the vncwebsocket upgrade unless the client negotiates the
        // "binary" subprotocol (this is what the stock Proxmox UI's own websocket client sends) —
        // passing protocols as the 2nd arg (not folded into options) is required to send it.
        const upstream = new WebSocket(wsUrl, ["binary"], {
          agent: new PinnedHttpsAgent(cluster.tlsFingerprint),
          headers: {
            Cookie: `PVEAuthCookie=${ticket?.ticket ?? ""}`,
            Referer: referer,
            // Every real browser sends this on a WS handshake (part of RFC 6455) — `ws` does not
            // add it automatically since it's not a browser. Sending none is a concrete, verified
            // difference from what pveproxy's own UI produces; add it back explicitly.
            Origin: `https://${cluster.host}:${cluster.port}`,
          },
        });
        upstreamRef = upstream;

        upstream.on("unexpected-response", (_req, res) => {
          let errBody = "";
          res.on("data", (chunk) => (errBody += chunk));
          res.on("end", () => {
            request.log.error({ statusCode: res.statusCode, errBody }, "console upstream rejected upgrade");
            fail(`Proxmox rejected the console connection (HTTP ${res.statusCode})`);
          });
        });

        upstream.on("open", () => {
          if (kind === "shell") {
            upstream.send(`${currentUser(request)}:${proxmoxTicket.ticket}\n`, { binary: false });
          }
          // Flush anything the browser sent while the ticket fetch / upstream handshake were
          // still in flight (see the buffering note above).
          for (const { data, isBinary } of bufferedFromClient.splice(0)) upstream.send(data, { binary: isBinary });
          recordAudit({
            clusterId,
            proxmoxUser: currentUser(request),
            action: `console.${kind}.open`,
            target: `${type}/${node}/${vmid}`,
            result: "success",
          });
        });

        // Relay upstream->client here; client->upstream is handled by the buffering listener
        // registered before the `try` block, above. Preserve frame type in this direction too.
        upstream.on("message", (data: Buffer, isBinary: boolean) => {
          if (awaitingShellAuthAck) {
            awaitingShellAuthAck = false;
            const isOk = data.length >= 2 && data[0] === 0x4f && data[1] === 0x4b; // "OK"
            if (!isOk) {
              request.log.warn({ preview: data.subarray(0, 32).toString() }, "termproxy auth line was not acknowledged with OK");
            }
            const rest = isOk ? data.subarray(2) : data;
            if (rest.length > 0 && socket.readyState === socket.OPEN) socket.send(rest, { binary: isBinary });
            return;
          }
          if (socket.readyState === socket.OPEN) socket.send(data, { binary: isBinary });
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
