import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateNetworkInterfaceInput, CreateSdnVnetInput, CreateSdnZoneInput } from "@proxmox-ui/shared";
import { apiDelete, apiFetch, apiPost } from "@/lib/api";

export function useNodeNetworkInterfaces(clusterId: string, node: string) {
  return useQuery({
    queryKey: ["network", clusterId, node],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/nodes/${node}/network`),
    enabled: Boolean(clusterId && node),
  });
}

export function useCreateNetworkInterface() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNetworkInterfaceInput) =>
      apiPost(`/clusters/${input.clusterId}/nodes/${input.node}/network`, input),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["network", vars.clusterId, vars.node] }),
  });
}

export function useDeleteNetworkInterface() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; node: string; iface: string }) =>
      apiDelete(`/clusters/${params.clusterId}/nodes/${params.node}/network/${params.iface}`),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["network", vars.clusterId, vars.node] }),
  });
}

export function useApplyNetworkConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; node: string }) =>
      apiPost(`/clusters/${params.clusterId}/nodes/${params.node}/network/apply`),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["network", vars.clusterId, vars.node] }),
  });
}

export function useSdnZones(clusterId: string) {
  return useQuery({
    queryKey: ["sdn-zones", clusterId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/sdn/zones`),
    enabled: Boolean(clusterId),
  });
}

export function useSdnVnets(clusterId: string) {
  return useQuery({
    queryKey: ["sdn-vnets", clusterId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/sdn/vnets`),
    enabled: Boolean(clusterId),
  });
}

export function useCreateSdnZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSdnZoneInput) => apiPost(`/clusters/${input.clusterId}/sdn/zones`, input),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["sdn-zones", vars.clusterId] }),
  });
}

export function useDeleteSdnZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; zone: string }) =>
      apiDelete(`/clusters/${params.clusterId}/sdn/zones/${params.zone}`),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["sdn-zones", vars.clusterId] }),
  });
}

export function useCreateSdnVnet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSdnVnetInput) => apiPost(`/clusters/${input.clusterId}/sdn/vnets`, input),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["sdn-vnets", vars.clusterId] }),
  });
}

export function useDeleteSdnVnet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { clusterId: string; vnet: string }) =>
      apiDelete(`/clusters/${params.clusterId}/sdn/vnets/${params.vnet}`),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["sdn-vnets", vars.clusterId] }),
  });
}

export function useApplySdnConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clusterId: string) => apiPost(`/clusters/${clusterId}/sdn/apply`),
    onSuccess: (_d, clusterId) => {
      queryClient.invalidateQueries({ queryKey: ["sdn-zones", clusterId] });
      queryClient.invalidateQueries({ queryKey: ["sdn-vnets", clusterId] });
    },
  });
}
