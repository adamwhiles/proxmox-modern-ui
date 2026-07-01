import type { ProxmoxHttpClient } from "../http.js";
import type { CreateLxcInput, CreateQemuInput, GuestAction } from "@proxmox-ui/shared";

type UPID = string;

function guestBase(type: "qemu" | "lxc", node: string, vmid: number): string {
  return `/nodes/${encodeURIComponent(node)}/${type}/${vmid}`;
}

export function listQemu(http: ProxmoxHttpClient, node: string) {
  return http.get<Array<Record<string, unknown>>>(`/nodes/${encodeURIComponent(node)}/qemu`);
}

export function listLxc(http: ProxmoxHttpClient, node: string) {
  return http.get<Array<Record<string, unknown>>>(`/nodes/${encodeURIComponent(node)}/lxc`);
}

export function getGuestConfig(http: ProxmoxHttpClient, type: "qemu" | "lxc", node: string, vmid: number) {
  return http.get<Record<string, unknown>>(`${guestBase(type, node, vmid)}/config`);
}

export function updateGuestConfig(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  params: Record<string, string | number | boolean>,
) {
  return http.put<void>(`${guestBase(type, node, vmid)}/config`, params);
}

/** Grows a disk to an absolute new size; Proxmox does not support shrinking online. */
export function resizeDisk(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  disk: string,
  sizeGiB: number,
) {
  return http.put<void>(`${guestBase(type, node, vmid)}/resize`, { disk, size: `${sizeGiB}G` });
}

export function guestAction(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  action: GuestAction,
) {
  return http.post<UPID>(`${guestBase(type, node, vmid)}/status/${action}`);
}

export function deleteGuest(http: ProxmoxHttpClient, type: "qemu" | "lxc", node: string, vmid: number) {
  return http.delete<UPID>(guestBase(type, node, vmid));
}

export function cloneGuest(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  newid: number,
  name?: string,
) {
  return http.post<UPID>(`${guestBase(type, node, vmid)}/clone`, { newid, name });
}

/** Builds a Proxmox disk option string, e.g. "local-lvm:32,cache=none,ssd=0,discard=on,iothread=1". */
function buildQemuDiskOptions(input: CreateQemuInput): string {
  return [
    `${input.storage}:${input.diskGiB}`,
    `cache=${input.diskCache}`,
    `ssd=${input.ssdEmulation ? 1 : 0}`,
    `discard=${input.discard ? "on" : "ignore"}`,
    `iothread=${input.ioThread ? 1 : 0}`,
  ].join(",");
}

/** Builds a Proxmox net option string, e.g. "virtio,bridge=vmbr0,tag=10,firewall=1". */
function buildQemuNetOptions(input: CreateQemuInput): string {
  return [
    input.netModel,
    `bridge=${input.bridge}`,
    ...(input.vlanTag ? [`tag=${input.vlanTag}`] : []),
    `firewall=${input.firewall ? 1 : 0}`,
  ].join(",");
}

export function createQemu(http: ProxmoxHttpClient, input: CreateQemuInput) {
  const diskKey = `${input.diskBus}0`;
  return http.post<UPID>(`/nodes/${encodeURIComponent(input.node)}/qemu`, {
    vmid: input.vmid,
    name: input.name,
    pool: input.pool,
    tags: input.tags,
    onboot: input.startOnBoot ? 1 : 0,
    ostype: input.ostype,
    bios: input.bios,
    machine: input.machine,
    scsihw: input.scsihw,
    agent: input.qemuAgent ? 1 : 0,
    sockets: input.sockets,
    cores: input.cores,
    cpu: input.cpuType,
    memory: input.memoryMiB,
    ...(input.balloonMiB > 0 ? { balloon: input.balloonMiB } : {}),
    [diskKey]: buildQemuDiskOptions(input),
    net0: buildQemuNetOptions(input),
    ...(input.isoStorage && input.isoFile
      ? { ide2: `${input.isoStorage}:iso/${input.isoFile},media=cdrom` }
      : {}),
  });
}

/** Builds a Proxmox LXC net0 option string. */
function buildLxcNetOptions(input: CreateLxcInput): string {
  return [
    "name=eth0",
    `bridge=${input.bridge}`,
    ...(input.vlanTag ? [`tag=${input.vlanTag}`] : []),
    input.useDhcp ? "ip=dhcp" : `ip=${input.ipAddressCidr}`,
    ...(!input.useDhcp && input.gateway ? [`gw=${input.gateway}`] : []),
    `firewall=${input.firewall ? 1 : 0}`,
  ].join(",");
}

export function createLxc(http: ProxmoxHttpClient, input: CreateLxcInput) {
  return http.post<UPID>(`/nodes/${encodeURIComponent(input.node)}/lxc`, {
    vmid: input.vmid,
    hostname: input.hostname,
    pool: input.pool,
    unprivileged: input.unprivileged ? 1 : 0,
    onboot: input.startOnBoot ? 1 : 0,
    cores: input.cores,
    memory: input.memoryMiB,
    swap: input.swapMiB,
    password: input.password,
    ostemplate: input.ostemplate,
    storage: input.storage,
    rootfs: `${input.storage}:${input.diskGiB}`,
    net0: buildLxcNetOptions(input),
    nameserver: input.nameserver,
    searchdomain: input.searchDomain,
  });
}

export function listSnapshots(http: ProxmoxHttpClient, type: "qemu" | "lxc", node: string, vmid: number) {
  return http.get<Array<{ name: string; description?: string; snaptime?: number; parent?: string }>>(
    `${guestBase(type, node, vmid)}/snapshot`,
  );
}

export function createSnapshot(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  name: string,
  description?: string,
) {
  return http.post<UPID>(`${guestBase(type, node, vmid)}/snapshot`, { snapname: name, description });
}

export function deleteSnapshot(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  name: string,
) {
  return http.delete<UPID>(`${guestBase(type, node, vmid)}/snapshot/${encodeURIComponent(name)}`);
}

export function rollbackSnapshot(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  name: string,
) {
  return http.post<UPID>(`${guestBase(type, node, vmid)}/snapshot/${encodeURIComponent(name)}/rollback`);
}

export interface GuestRrdRaw {
  time: number;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
}

export function getGuestRrdData(
  http: ProxmoxHttpClient,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  timeframe: "hour" | "day" | "week" | "month" | "year" = "hour",
) {
  return http.get<GuestRrdRaw[]>(`${guestBase(type, node, vmid)}/rrddata`, { timeframe, cf: "AVERAGE" });
}
