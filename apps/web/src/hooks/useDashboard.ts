import { useQuery } from "@tanstack/react-query";
import type { ClusterHealth, ClusterResource } from "@proxmox-ui/shared";
import { apiFetch } from "@/lib/api";

interface DashboardResponse {
  resources: ClusterResource[];
  errors: Record<string, string>;
}

export function useDashboardResources() {
  return useQuery({
    queryKey: ["dashboard", "resources"],
    queryFn: () => apiFetch<DashboardResponse>("/dashboard/resources"),
    refetchInterval: 10_000,
  });
}

export function useClusterHealth() {
  return useQuery({
    queryKey: ["dashboard", "cluster-status"],
    queryFn: () => apiFetch<ClusterHealth[]>("/dashboard/cluster-status"),
    refetchInterval: 15_000,
  });
}

export function useNodeStatus(clusterId: string, node: string) {
  return useQuery({
    queryKey: ["node", clusterId, node, "status"],
    queryFn: () => apiFetch<Record<string, unknown>>(`/clusters/${clusterId}/nodes/${node}/status`),
    enabled: Boolean(clusterId && node),
    refetchInterval: 15_000,
  });
}

export function useNodeRrdData(clusterId: string, node: string, timeframe: "hour" | "day" | "week" = "hour") {
  return useQuery({
    queryKey: ["node", clusterId, node, "rrddata", timeframe],
    queryFn: () =>
      apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/nodes/${node}/rrddata?timeframe=${timeframe}`),
    enabled: Boolean(clusterId && node),
    refetchInterval: 15_000,
  });
}
