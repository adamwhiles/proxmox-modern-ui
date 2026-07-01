import type { ProxmoxHttpClient } from "../http.js";

export interface RawNodeStatus {
  uptime: number;
  cpu: number;
  cpuinfo?: { cpus: number };
  memory: { used: number; total: number; free: number };
  loadavg?: string[];
  pveversion?: string;
}

export function listNodes(http: ProxmoxHttpClient) {
  return http.get<Array<{ node: string; status: string; cpu?: number; maxcpu?: number; mem?: number; maxmem?: number; uptime?: number }>>(
    "/nodes",
  );
}

export function getNodeStatus(http: ProxmoxHttpClient, node: string) {
  return http.get<RawNodeStatus>(`/nodes/${encodeURIComponent(node)}/status`);
}

export interface RrdDataPoint {
  time: number;
  cpu?: number;
  memused?: number;
  memtotal?: number;
  netin?: number;
  netout?: number;
}

export function getNodeRrdData(
  http: ProxmoxHttpClient,
  node: string,
  timeframe: "hour" | "day" | "week" | "month" | "year" = "hour",
) {
  return http.get<RrdDataPoint[]>(`/nodes/${encodeURIComponent(node)}/rrddata`, { timeframe, cf: "AVERAGE" });
}
