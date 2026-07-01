import type { ProxmoxHttpClient } from "../http.js";

export interface RawClusterResource {
  id: string;
  type: string;
  node?: string;
  vmid?: number;
  name?: string;
  status?: string;
  uptime?: number;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  tags?: string;
  template?: 0 | 1;
}

export interface RawClusterStatus {
  id: string;
  type: string;
  name: string;
  nodes?: number;
  quorate?: number;
  online?: number;
  ip?: string;
  local?: number;
}

/** A single call that returns every node/VM/LXC/storage entry across the whole cluster. */
export function getClusterResources(http: ProxmoxHttpClient, type?: "vm" | "storage" | "node" | "sdn" | "pool") {
  return http.get<RawClusterResource[]>("/cluster/resources", type ? { type } : undefined);
}

export function getClusterStatus(http: ProxmoxHttpClient) {
  return http.get<RawClusterStatus[]>("/cluster/status");
}
