import { z } from "zod";

/** Mirrors a single entry from Proxmox's /cluster/resources aggregate endpoint. */
export const ClusterResourceSchema = z.object({
  clusterId: z.string().uuid(),
  clusterName: z.string(),
  id: z.string(),
  type: z.enum(["node", "qemu", "lxc", "storage", "sdn", "pool"]),
  node: z.string().optional(),
  vmid: z.number().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  uptime: z.number().optional(),
  cpu: z.number().optional(),
  maxcpu: z.number().optional(),
  mem: z.number().optional(),
  maxmem: z.number().optional(),
  disk: z.number().optional(),
  maxdisk: z.number().optional(),
  tags: z.string().optional(),
  template: z.union([z.literal(0), z.literal(1)]).optional(),
});
export type ClusterResource = z.infer<typeof ClusterResourceSchema>;

export const ClusterHealthSchema = z.object({
  clusterId: z.string().uuid(),
  clusterName: z.string(),
  /** Single-node "clusters" (no /cluster/status cluster-type entry) report quorate as true. */
  quorate: z.boolean(),
  nodeCount: z.number(),
  onlineNodeCount: z.number(),
});
export type ClusterHealth = z.infer<typeof ClusterHealthSchema>;

export const NodeStatusSchema = z.object({
  clusterId: z.string().uuid(),
  node: z.string(),
  status: z.string(),
  uptime: z.number(),
  cpu: z.number(),
  maxcpu: z.number(),
  memory: z.object({ used: z.number(), total: z.number(), free: z.number() }),
  loadavg: z.array(z.string()).optional(),
  pveVersion: z.string().optional(),
});
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
