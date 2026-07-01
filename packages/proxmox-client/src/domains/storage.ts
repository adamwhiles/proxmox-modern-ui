import type { ProxmoxHttpClient } from "../http.js";
import type { CreateStorageInput, DownloadUrlInput, UpdateStorageInput } from "@proxmox-ui/shared";

export function listNodeStorage(http: ProxmoxHttpClient, node: string) {
  return http.get<Array<Record<string, unknown>>>(`/nodes/${encodeURIComponent(node)}/storage`);
}

export function listStorageContent(http: ProxmoxHttpClient, node: string, storage: string, content?: string) {
  return http.get<Array<Record<string, unknown>>>(
    `/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/content`,
    content ? { content } : undefined,
  );
}

export function deleteStorageContent(http: ProxmoxHttpClient, node: string, storage: string, volid: string) {
  return http.delete<string>(
    `/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}/content/${encodeURIComponent(volid)}`,
  );
}

export function downloadUrl(http: ProxmoxHttpClient, input: DownloadUrlInput) {
  return http.post<string>(`/nodes/${encodeURIComponent(input.node)}/storage/${encodeURIComponent(input.storage)}/download-url`, {
    content: input.content,
    filename: input.filename,
    url: input.url,
  });
}

/** Cluster-wide storage configuration (storage.cfg), as opposed to the per-node usage view above. */
export function listClusterStorage(http: ProxmoxHttpClient) {
  return http.get<Array<Record<string, unknown>>>("/storage");
}

function typeSpecificParams(input: CreateStorageInput): Record<string, string | number | boolean> {
  switch (input.type) {
    case "dir":
      return { path: input.path };
    case "nfs":
      return { server: input.server, export: input.export };
    case "cifs":
      return {
        server: input.server,
        share: input.share,
        ...(input.username ? { username: input.username } : {}),
        ...(input.password ? { password: input.password } : {}),
        ...(input.domain ? { domain: input.domain } : {}),
      };
    case "lvmthin":
      return { vgname: input.vgname, thinpool: input.thinpool };
  }
}

export function createStorage(http: ProxmoxHttpClient, input: CreateStorageInput) {
  return http.post<void>("/storage", {
    storage: input.storageId,
    type: input.type,
    content: input.content.join(","),
    ...(input.nodes ? { nodes: input.nodes } : {}),
    shared: input.shared ? 1 : 0,
    disable: input.disable ? 1 : 0,
    ...typeSpecificParams(input),
  });
}

export function updateStorage(http: ProxmoxHttpClient, storageId: string, input: UpdateStorageInput) {
  const params: Record<string, string | number> = {};
  if (input.content) params.content = input.content.join(",");
  if (input.disable !== undefined) params.disable = input.disable ? 1 : 0;
  if (input.nodes !== undefined) params.nodes = input.nodes;
  return http.put<void>(`/storage/${encodeURIComponent(storageId)}`, params);
}

export function deleteStorage(http: ProxmoxHttpClient, storageId: string) {
  return http.delete<void>(`/storage/${encodeURIComponent(storageId)}`);
}
