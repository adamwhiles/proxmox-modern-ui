import type { ProxmoxHttpClient } from "../http.js";
import type {
  CreateNetworkInterfaceInput,
  CreateSdnVnetInput,
  CreateSdnZoneInput,
  UpdateNetworkInterfaceInput,
} from "@proxmox-ui/shared";

export function listNodeNetwork(http: ProxmoxHttpClient, node: string) {
  return http.get<Array<Record<string, unknown>>>(`/nodes/${encodeURIComponent(node)}/network`);
}

function ifaceCommonParams(input: {
  autostart: boolean;
  address?: string;
  netmask?: string;
  gateway?: string;
  comments?: string;
}): Record<string, string | number> {
  return {
    autostart: input.autostart ? 1 : 0,
    ...(input.address ? { address: input.address } : {}),
    ...(input.netmask ? { netmask: input.netmask } : {}),
    ...(input.gateway ? { gateway: input.gateway } : {}),
    ...(input.comments ? { comments: input.comments } : {}),
  };
}

export function createNetworkInterface(http: ProxmoxHttpClient, input: CreateNetworkInterfaceInput) {
  const common = ifaceCommonParams(input);
  const params =
    input.type === "bridge"
      ? {
          iface: input.iface,
          type: "bridge",
          ...common,
          ...(input.bridgePorts ? { bridge_ports: input.bridgePorts } : {}),
          bridge_vlan_aware: input.vlanAware ? 1 : 0,
        }
      : {
          iface: input.iface,
          type: "vlan",
          ...common,
          vlan_raw_device: input.vlanRawDevice,
          "vlan-id": input.vlanId,
        };
  return http.post<void>(`/nodes/${encodeURIComponent(input.node)}/network`, params);
}

export function updateNetworkInterface(http: ProxmoxHttpClient, input: UpdateNetworkInterfaceInput) {
  const params: Record<string, string | number> = {};
  if (input.autostart !== undefined) params.autostart = input.autostart ? 1 : 0;
  if (input.address !== undefined) params.address = input.address;
  if (input.netmask !== undefined) params.netmask = input.netmask;
  if (input.gateway !== undefined) params.gateway = input.gateway;
  if (input.bridgePorts !== undefined) params.bridge_ports = input.bridgePorts;
  if (input.comments !== undefined) params.comments = input.comments;
  return http.put<void>(`/nodes/${encodeURIComponent(input.node)}/network/${encodeURIComponent(input.iface)}`, params);
}

export function deleteNetworkInterface(http: ProxmoxHttpClient, node: string, iface: string) {
  return http.delete<void>(`/nodes/${encodeURIComponent(node)}/network/${encodeURIComponent(iface)}`);
}

/** Applies all pending interface changes on this node (rewrites /etc/network/interfaces and reloads). */
export function applyNetworkConfig(http: ProxmoxHttpClient, node: string) {
  return http.put<string>(`/nodes/${encodeURIComponent(node)}/network`);
}

export function listSdnZones(http: ProxmoxHttpClient) {
  return http.get<Array<Record<string, unknown>>>("/cluster/sdn/zones");
}

export function listSdnVnets(http: ProxmoxHttpClient) {
  return http.get<Array<Record<string, unknown>>>("/cluster/sdn/vnets");
}

export function createSdnZone(http: ProxmoxHttpClient, input: CreateSdnZoneInput) {
  return http.post<void>("/cluster/sdn/zones", {
    zone: input.zone,
    type: input.type,
    ...(input.bridge ? { bridge: input.bridge } : {}),
    ...(input.nodes ? { nodes: input.nodes } : {}),
    ...(input.mtu ? { mtu: input.mtu } : {}),
  });
}

export function deleteSdnZone(http: ProxmoxHttpClient, zone: string) {
  return http.delete<void>(`/cluster/sdn/zones/${encodeURIComponent(zone)}`);
}

export function createSdnVnet(http: ProxmoxHttpClient, input: CreateSdnVnetInput) {
  return http.post<void>("/cluster/sdn/vnets", {
    vnet: input.vnet,
    zone: input.zone,
    ...(input.tag ? { tag: input.tag } : {}),
    ...(input.alias ? { alias: input.alias } : {}),
  });
}

export function deleteSdnVnet(http: ProxmoxHttpClient, vnet: string) {
  return http.delete<void>(`/cluster/sdn/vnets/${encodeURIComponent(vnet)}`);
}

/** Applies all pending SDN changes cluster-wide. */
export function applySdnConfig(http: ProxmoxHttpClient) {
  return http.put<string>("/cluster/sdn");
}
