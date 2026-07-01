import { z } from "zod";

/** A registered Proxmox cluster/node the app can connect to. */
export const ClusterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(8006),
  /** SHA-256 fingerprint of the server's TLS certificate, colon-hex form, pinned at add-time (TOFU). */
  tlsFingerprint: z.string().regex(/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){31}$/),
  defaultRealm: z.string().min(1).default("pam"),
  createdAt: z.string().datetime(),
});
export type Cluster = z.infer<typeof ClusterSchema>;

export const CreateClusterInputSchema = z.object({
  name: z.string().min(1).max(64),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(8006),
  defaultRealm: z.string().min(1).default("pam"),
  /** Fingerprint the operator confirmed after previewing the cert (TOFU flow). */
  tlsFingerprint: z.string().regex(/^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){31}$/),
});
export type CreateClusterInput = z.infer<typeof CreateClusterInputSchema>;

/** Returned when probing a new host so the operator can verify the fingerprint before pinning it. */
export const ClusterProbeResultSchema = z.object({
  host: z.string(),
  port: z.number(),
  tlsFingerprint: z.string(),
  issuer: z.string(),
  subject: z.string(),
  validFrom: z.string(),
  validTo: z.string(),
});
export type ClusterProbeResult = z.infer<typeof ClusterProbeResultSchema>;

export const ClusterConnectionStatusSchema = z.enum(["connected", "disconnected", "error"]);
export type ClusterConnectionStatus = z.infer<typeof ClusterConnectionStatusSchema>;

export const ClusterSessionStateSchema = z.object({
  clusterId: z.string().uuid(),
  name: z.string(),
  status: ClusterConnectionStatusSchema,
  username: z.string().optional(),
  error: z.string().optional(),
});
export type ClusterSessionState = z.infer<typeof ClusterSessionStateSchema>;
