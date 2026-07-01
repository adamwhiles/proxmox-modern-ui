import https from "node:https";
import tls from "node:tls";
import type http from "node:http";
import type { Duplex } from "node:stream";
import { normalizeFingerprint } from "@proxmox-ui/proxmox-client";

/**
 * An https.Agent whose sole trust criterion is an exact SHA-256 leaf certificate fingerprint match.
 * Used to establish the outbound Upgrade request for the console websocket relay (see console/routes.ts),
 * mirroring the same pinning policy as the REST client's undici agent (proxmox-client/src/tls.ts).
 */
export class PinnedHttpsAgent extends https.Agent {
  constructor(private readonly pinnedFingerprint: string) {
    super({ rejectUnauthorized: false });
  }

  override createConnection(
    options: http.RequestOptions,
    callback?: (err: Error | null, stream: Duplex) => void,
  ): Duplex | null | undefined {
    const expected = normalizeFingerprint(this.pinnedFingerprint);
    const socket = tls.connect({
      host: options.host ?? undefined,
      port: Number(options.port),
      servername: (options as { servername?: string }).servername ?? options.host ?? undefined,
      rejectUnauthorized: false,
    });

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const actual = cert?.fingerprint256 ? normalizeFingerprint(cert.fingerprint256) : "";
      if (actual !== expected) {
        socket.destroy();
        callback?.(new Error("TLS certificate fingerprint mismatch on console relay connection"), socket);
        return;
      }
      callback?.(null, socket);
    });
    socket.once("error", (err) => callback?.(err, socket));

    return undefined; // completion is signaled asynchronously via callback, per Agent contract
  }
}
