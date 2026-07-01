import type { ProxmoxHttpClient } from "../http.js";

export function listBackupJobs(http: ProxmoxHttpClient) {
  return http.get<Array<Record<string, unknown>>>("/cluster/backup");
}

export function createVzdump(
  http: ProxmoxHttpClient,
  node: string,
  params: { vmid: number; storage: string; mode?: "snapshot" | "suspend" | "stop"; compress?: string },
) {
  return http.post<string>(`/nodes/${encodeURIComponent(node)}/vzdump`, params);
}
