import tls from "node:tls";
import { Agent } from "undici";

/**
 * Proxmox VE ships a self-signed cert by default, so we can't rely on the system CA store.
 * Instead we pin the exact SHA-256 leaf fingerprint the operator confirmed when the cluster
 * was registered (TOFU), and verify it ourselves on every connection.
 */
export class CertificateFingerprintMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`TLS certificate fingerprint mismatch: expected ${expected}, got ${actual}`);
    this.name = "CertificateFingerprintMismatchError";
  }
}

export function normalizeFingerprint(fp: string): string {
  return fp.replace(/:/g, "").toUpperCase();
}

export function formatFingerprint(fp: string): string {
  const normalized = normalizeFingerprint(fp);
  return normalized.match(/.{2}/g)?.join(":") ?? normalized;
}

interface UndiciConnectOptions {
  hostname: string;
  port: string | number;
  servername?: string;
}
type UndiciConnectCallback = (err: Error | null, socket: tls.TLSSocket | null) => void;

/** Builds an undici Agent whose TLS connections are only trusted if the leaf cert matches the pin. */
export function createPinnedAgent(pinnedFingerprint: string): Agent {
  const expected = normalizeFingerprint(pinnedFingerprint);

  return new Agent({
    connect: ((opts: UndiciConnectOptions, callback: UndiciConnectCallback) => {
      const socket = tls.connect({
        host: opts.hostname,
        port: Number(opts.port),
        servername: opts.servername ?? opts.hostname,
        // We deliberately skip CA-chain verification: Proxmox certs are usually self-signed.
        // Trust is instead established by the exact-fingerprint check below.
        rejectUnauthorized: false,
      });

      const onSecure = () => {
        socket.off("error", onError);
        const cert = socket.getPeerCertificate();
        if (!cert || !cert.fingerprint256) {
          socket.destroy();
          callback(new Error("Unable to read peer certificate for pinning"), null);
          return;
        }
        const actual = normalizeFingerprint(cert.fingerprint256);
        if (actual !== expected) {
          socket.destroy();
          callback(new CertificateFingerprintMismatchError(expected, actual), null);
          return;
        }
        callback(null, socket);
      };
      const onError = (err: Error) => {
        socket.off("secureConnect", onSecure);
        callback(err, null);
      };

      socket.once("secureConnect", onSecure);
      socket.once("error", onError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });
}

export interface CertificateProbe {
  tlsFingerprint: string;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
}

/** Connects once without verification to surface the cert for an operator to confirm (TOFU add-cluster flow). */
export function probeCertificate(host: string, port: number, timeoutMs = 5000): Promise<CertificateProbe> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host,
      port,
      servername: host,
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert || !cert.fingerprint256) {
        reject(new Error("Server did not present a certificate"));
        return;
      }
      resolve({
        tlsFingerprint: formatFingerprint(cert.fingerprint256),
        issuer: Object.entries(cert.issuer ?? {})
          .map(([k, v]) => `${k}=${v}`)
          .join(", "),
        subject: Object.entries(cert.subject ?? {})
          .map(([k, v]) => `${k}=${v}`)
          .join(", "),
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
      });
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`Connection to ${host}:${port} timed out`));
    });
    socket.once("error", (err) => reject(err));
  });
}
