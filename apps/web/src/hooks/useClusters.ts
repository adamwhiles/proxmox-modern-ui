import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cluster, ClusterProbeResult, CreateClusterInput } from "@proxmox-ui/shared";
import { apiDelete, apiFetch } from "@/lib/api";

type PublicCluster = Omit<Cluster, "tlsFingerprint">;

export function useClusterRegistry() {
  return useQuery({
    queryKey: ["clusters", "registry"],
    queryFn: () => apiFetch<PublicCluster[]>("/clusters"),
  });
}

export function useConnectedClusters() {
  return useQuery({
    queryKey: ["clusters", "connections"],
    queryFn: () => apiFetch<Array<{ id: string; name: string; host: string; connected: boolean }>>("/dashboard/clusters"),
  });
}

export function useProbeCluster() {
  return useMutation({
    mutationFn: (input: { host: string; port: number; setupToken?: string }) =>
      apiFetch<ClusterProbeResult>("/clusters/probe", {
        method: "POST",
        body: JSON.stringify({ host: input.host, port: input.port }),
        headers: input.setupToken ? { "X-Setup-Token": input.setupToken } : undefined,
      }),
  });
}

export function useCreateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClusterInput & { setupToken?: string }) => {
      const { setupToken, ...body } = input;
      return apiFetch<PublicCluster>("/clusters", {
        method: "POST",
        body: JSON.stringify(body),
        headers: setupToken ? { "X-Setup-Token": setupToken } : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/clusters/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clusters"] }),
  });
}
