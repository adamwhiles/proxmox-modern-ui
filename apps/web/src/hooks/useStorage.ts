import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateStorageInput, DownloadUrlInput, UpdateStorageInput } from "@proxmox-ui/shared";
import { apiDelete, apiFetch, apiPost, apiPut } from "@/lib/api";

export function useClusterStorage(clusterId: string) {
  return useQuery({
    queryKey: ["cluster-storage", clusterId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/storage`),
    enabled: Boolean(clusterId),
  });
}

export function useCreateStorage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStorageInput) => apiPost(`/clusters/${input.clusterId}/storage`, input),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["cluster-storage", vars.clusterId] }),
  });
}

export function useUpdateStorage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; storageId: string; input: UpdateStorageInput }) =>
      apiPut(`/clusters/${params.clusterId}/storage/${params.storageId}`, params.input),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["cluster-storage", vars.clusterId] }),
  });
}

export function useDeleteStorage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; storageId: string }) =>
      apiDelete(`/clusters/${params.clusterId}/storage/${params.storageId}`),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["cluster-storage", vars.clusterId] }),
  });
}

export function useStorageContentList(clusterId: string, node: string, storage: string) {
  return useQuery({
    queryKey: ["storage-content-full", clusterId, node, storage],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/nodes/${node}/storage/${storage}/content`),
    enabled: Boolean(clusterId && node && storage),
  });
}

export function useDeleteStorageContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; node: string; storage: string; volid: string }) =>
      apiDelete(`/clusters/${params.clusterId}/nodes/${params.node}/storage/${params.storage}/content/${encodeURIComponent(params.volid)}`),
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: ["storage-content-full", vars.clusterId, vars.node, vars.storage] }),
  });
}

export function useDownloadUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DownloadUrlInput) =>
      apiPost<{ upid: string }>(`/clusters/${input.clusterId}/nodes/${input.node}/storage/${input.storage}/download-url`, input),
    onSuccess: (_d, vars) =>
      queryClient.invalidateQueries({ queryKey: ["storage-content-full", vars.clusterId, vars.node, vars.storage] }),
  });
}
