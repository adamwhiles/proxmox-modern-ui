import type { Dispatcher } from "undici";
import { ProxmoxHttpClient, type ProxmoxTicket } from "./http.js";
import * as resources from "./domains/resources.js";
import * as nodes from "./domains/nodes.js";
import * as guests from "./domains/guests.js";
import * as storage from "./domains/storage.js";
import * as network from "./domains/network.js";
import * as backup from "./domains/backup.js";
import * as tasks from "./domains/tasks.js";
import * as consoleApi from "./domains/console.js";
import type {
  CreateLxcInput,
  CreateNetworkInterfaceInput,
  CreateQemuInput,
  CreateSdnVnetInput,
  CreateSdnZoneInput,
  CreateStorageInput,
  DownloadUrlInput,
  GuestAction,
  UpdateNetworkInterfaceInput,
  UpdateStorageInput,
} from "@proxmox-ui/shared";

export interface ProxmoxClientOptions {
  host: string;
  port?: number;
  tlsFingerprint: string;
  dispatcher?: Dispatcher;
}

/** A high-level, typed facade over one Proxmox cluster's REST API. */
export class ProxmoxClient {
  readonly http: ProxmoxHttpClient;

  constructor(opts: ProxmoxClientOptions) {
    this.http = new ProxmoxHttpClient(opts);
  }

  login(username: string, password: string, realm = "pam", otp?: string) {
    return this.http.login(username, password, realm, otp);
  }

  refresh() {
    return this.http.refresh();
  }

  restoreTicket(ticket: ProxmoxTicket) {
    this.http.setTicket(ticket);
  }

  getTicket() {
    return this.http.getTicket();
  }

  // -- aggregation --
  getClusterResources = (type?: "vm" | "storage" | "node" | "sdn" | "pool") =>
    resources.getClusterResources(this.http, type);
  getClusterStatus = () => resources.getClusterStatus(this.http);

  // -- nodes --
  listNodes = () => nodes.listNodes(this.http);
  getNodeStatus = (node: string) => nodes.getNodeStatus(this.http, node);
  getNodeRrdData = (node: string, timeframe?: "hour" | "day" | "week" | "month" | "year") =>
    nodes.getNodeRrdData(this.http, node, timeframe);

  // -- guests (qemu + lxc) --
  listQemu = (node: string) => guests.listQemu(this.http, node);
  listLxc = (node: string) => guests.listLxc(this.http, node);
  getGuestConfig = (type: "qemu" | "lxc", node: string, vmid: number) =>
    guests.getGuestConfig(this.http, type, node, vmid);
  updateGuestConfig = (
    type: "qemu" | "lxc",
    node: string,
    vmid: number,
    params: Record<string, string | number | boolean>,
  ) => guests.updateGuestConfig(this.http, type, node, vmid, params);
  resizeDisk = (type: "qemu" | "lxc", node: string, vmid: number, disk: string, sizeGiB: number) =>
    guests.resizeDisk(this.http, type, node, vmid, disk, sizeGiB);
  getGuestRrdData = (
    type: "qemu" | "lxc",
    node: string,
    vmid: number,
    timeframe?: "hour" | "day" | "week" | "month" | "year",
  ) => guests.getGuestRrdData(this.http, type, node, vmid, timeframe);
  guestAction = (type: "qemu" | "lxc", node: string, vmid: number, action: GuestAction) =>
    guests.guestAction(this.http, type, node, vmid, action);
  deleteGuest = (type: "qemu" | "lxc", node: string, vmid: number) =>
    guests.deleteGuest(this.http, type, node, vmid);
  cloneGuest = (type: "qemu" | "lxc", node: string, vmid: number, newid: number, name?: string) =>
    guests.cloneGuest(this.http, type, node, vmid, newid, name);
  createQemu = (input: CreateQemuInput) => guests.createQemu(this.http, input);
  createLxc = (input: CreateLxcInput) => guests.createLxc(this.http, input);
  listSnapshots = (type: "qemu" | "lxc", node: string, vmid: number) =>
    guests.listSnapshots(this.http, type, node, vmid);
  createSnapshot = (type: "qemu" | "lxc", node: string, vmid: number, name: string, description?: string) =>
    guests.createSnapshot(this.http, type, node, vmid, name, description);
  deleteSnapshot = (type: "qemu" | "lxc", node: string, vmid: number, name: string) =>
    guests.deleteSnapshot(this.http, type, node, vmid, name);
  rollbackSnapshot = (type: "qemu" | "lxc", node: string, vmid: number, name: string) =>
    guests.rollbackSnapshot(this.http, type, node, vmid, name);

  // -- storage --
  listNodeStorage = (node: string) => storage.listNodeStorage(this.http, node);
  listStorageContent = (node: string, storageId: string, content?: string) =>
    storage.listStorageContent(this.http, node, storageId, content);
  deleteStorageContent = (node: string, storageId: string, volid: string) =>
    storage.deleteStorageContent(this.http, node, storageId, volid);
  downloadUrl = (input: DownloadUrlInput) => storage.downloadUrl(this.http, input);
  listClusterStorage = () => storage.listClusterStorage(this.http);
  createStorage = (input: CreateStorageInput) => storage.createStorage(this.http, input);
  updateStorage = (storageId: string, input: UpdateStorageInput) => storage.updateStorage(this.http, storageId, input);
  deleteStorage = (storageId: string) => storage.deleteStorage(this.http, storageId);

  // -- network --
  listNodeNetwork = (node: string) => network.listNodeNetwork(this.http, node);
  createNetworkInterface = (input: CreateNetworkInterfaceInput) => network.createNetworkInterface(this.http, input);
  updateNetworkInterface = (input: UpdateNetworkInterfaceInput) => network.updateNetworkInterface(this.http, input);
  deleteNetworkInterface = (node: string, iface: string) => network.deleteNetworkInterface(this.http, node, iface);
  applyNetworkConfig = (node: string) => network.applyNetworkConfig(this.http, node);
  listSdnZones = () => network.listSdnZones(this.http);
  listSdnVnets = () => network.listSdnVnets(this.http);
  createSdnZone = (input: CreateSdnZoneInput) => network.createSdnZone(this.http, input);
  deleteSdnZone = (zone: string) => network.deleteSdnZone(this.http, zone);
  createSdnVnet = (input: CreateSdnVnetInput) => network.createSdnVnet(this.http, input);
  deleteSdnVnet = (vnet: string) => network.deleteSdnVnet(this.http, vnet);
  applySdnConfig = () => network.applySdnConfig(this.http);

  // -- backup --
  listBackupJobs = () => backup.listBackupJobs(this.http);
  createVzdump = (
    node: string,
    params: { vmid: number; storage: string; mode?: "snapshot" | "suspend" | "stop"; compress?: string },
  ) => backup.createVzdump(this.http, node, params);

  // -- tasks --
  getTaskStatus = (node: string, upid: string) => tasks.getTaskStatus(this.http, node, upid);
  getTaskLog = (node: string, upid: string, start?: number, limit?: number) =>
    tasks.getTaskLog(this.http, node, upid, start, limit);
  listClusterTasks = () => tasks.listClusterTasks(this.http);

  // -- console --
  getVncProxyTicket = (type: "qemu" | "lxc", node: string, vmid: number) =>
    consoleApi.getVncProxyTicket(this.http, type, node, vmid);
  getTermProxyTicket = (type: "qemu" | "lxc", node: string, vmid: number) =>
    consoleApi.getTermProxyTicket(this.http, type, node, vmid);
  buildConsoleWebsocketUrl = (
    node: string,
    type: "qemu" | "lxc",
    vmid: number,
    vncPort: string,
    vncTicket: string,
  ) => {
    const url = new URL(this.http.baseUrl.replace("/api2/json", ""));
    return consoleApi.buildConsoleWebsocketUrl(
      url.hostname,
      Number(url.port || 8006),
      node,
      type,
      vmid,
      vncPort,
      vncTicket,
    );
  };
  buildConsoleReferer = (node: string, type: "qemu" | "lxc", vmid: number, mode: "xtermjs" | "novnc") => {
    const url = new URL(this.http.baseUrl.replace("/api2/json", ""));
    return consoleApi.buildConsoleReferer(url.hostname, Number(url.port || 8006), type, node, vmid, mode);
  };
}
