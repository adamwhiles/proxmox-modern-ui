import type { ProxmoxHttpClient } from "../http.js";

export interface RawTaskStatus {
  upid: string;
  node: string;
  type: string;
  status: "running" | "stopped";
  exitstatus?: string;
  user?: string;
  starttime?: number;
}

export function getTaskStatus(http: ProxmoxHttpClient, node: string, upid: string) {
  return http.get<RawTaskStatus>(`/nodes/${encodeURIComponent(node)}/tasks/${encodeURIComponent(upid)}/status`);
}

export function getTaskLog(http: ProxmoxHttpClient, node: string, upid: string, start = 0, limit = 500) {
  return http.get<Array<{ n: number; t: string }>>(
    `/nodes/${encodeURIComponent(node)}/tasks/${encodeURIComponent(upid)}/log`,
    { start, limit },
  );
}

export function listClusterTasks(http: ProxmoxHttpClient) {
  return http.get<Array<Record<string, unknown>>>("/cluster/tasks");
}
