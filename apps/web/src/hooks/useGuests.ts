import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateLxcInput,
  CreateQemuInput,
  GuestAction,
  GuestRrdDataPoint,
  UpdateLxcConfigInput,
  UpdateQemuConfigInput,
} from "@proxmox-ui/shared";
import { apiDelete, apiFetch, apiPost, apiPut } from "@/lib/api";

export type GuestType = "qemu" | "lxc";

export function useGuestConfig(clusterId: string, node: string, type: GuestType, vmid: number) {
  return useQuery({
    queryKey: ["guest", clusterId, node, type, vmid, "config"],
    queryFn: () => apiFetch<Record<string, unknown>>(`/clusters/${clusterId}/nodes/${node}/${type}/${vmid}/config`),
    enabled: Boolean(clusterId && node && vmid),
  });
}

export function useGuestSnapshots(clusterId: string, node: string, type: GuestType, vmid: number) {
  return useQuery({
    queryKey: ["guest", clusterId, node, type, vmid, "snapshots"],
    queryFn: () =>
      apiFetch<Array<{ name: string; description?: string; snaptime?: number }>>(
        `/clusters/${clusterId}/nodes/${node}/${type}/${vmid}/snapshots`,
      ),
    enabled: Boolean(clusterId && node && vmid),
  });
}

export function useGuestRrdData(
  clusterId: string,
  node: string,
  type: GuestType,
  vmid: number,
  timeframe: "hour" | "day" | "week" = "hour",
) {
  return useQuery({
    queryKey: ["guest", clusterId, node, type, vmid, "rrddata", timeframe],
    queryFn: () =>
      apiFetch<GuestRrdDataPoint[]>(
        `/clusters/${clusterId}/nodes/${node}/${type}/${vmid}/rrddata?timeframe=${timeframe}`,
      ),
    enabled: Boolean(clusterId && node && vmid),
    refetchInterval: 15_000,
  });
}

export function useNodeStorage(clusterId: string, node: string) {
  return useQuery({
    queryKey: ["storage", clusterId, node],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/nodes/${node}/storage`),
    enabled: Boolean(clusterId && node),
  });
}

export function useStorageContent(clusterId: string, node: string, storage: string, content: string) {
  return useQuery({
    queryKey: ["storage-content", clusterId, node, storage, content],
    queryFn: () =>
      apiFetch<Array<{ volid: string }>>(
        `/clusters/${clusterId}/nodes/${node}/storage/${storage}/content?content=${content}`,
      ),
    enabled: Boolean(clusterId && node && storage),
  });
}

export function useGuestAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; node: string; type: GuestType; vmid: number; action: GuestAction }) =>
      apiPost<{ upid: string }>(`/clusters/${params.clusterId}/nodes/${params.node}/${params.type}/${params.vmid}/action`, {
        action: params.action,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

export function useDeleteGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; node: string; type: GuestType; vmid: number }) =>
      apiDelete<{ upid: string }>(`/clusters/${params.clusterId}/nodes/${params.node}/${params.type}/${params.vmid}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

export function useCreateQemu() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQemuInput) =>
      apiPost<{ upid: string }>(`/clusters/${input.clusterId}/nodes/${input.node}/qemu`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

export function useCreateLxc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLxcInput) =>
      apiPost<{ upid: string }>(`/clusters/${input.clusterId}/nodes/${input.node}/lxc`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

export function useUpdateGuestConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      clusterId: string;
      node: string;
      type: GuestType;
      vmid: number;
      input: UpdateQemuConfigInput | UpdateLxcConfigInput;
    }) =>
      apiPut<{ ok: true }>(
        `/clusters/${params.clusterId}/nodes/${params.node}/${params.type}/${params.vmid}/config`,
        params.input,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["guest", variables.clusterId, variables.node, variables.type, variables.vmid, "config"],
      });
    },
  });
}
