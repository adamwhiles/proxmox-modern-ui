import type { ProxmoxHttpClient } from "../http.js";

export interface ConsoleTicket {
  port: string;
  ticket: string;
  /** Only present for termproxy (shell) sessions. */
  upid?: string;
}

/** VNC console ticket. Works with either a user ticket or a privilege-separated API token. */
export function getVncProxyTicket(http: ProxmoxHttpClient, type: "qemu" | "lxc", node: string, vmid: number) {
  return http.post<ConsoleTicket>(`/nodes/${encodeURIComponent(node)}/${type}/${vmid}/vncproxy`, {
    websocket: 1,
  });
}

/**
 * Shell console ticket. Proxmox requires a real user ticket for this endpoint — API tokens are
 * rejected — which is why this project uses delegated (login) auth rather than service tokens.
 */
export function getTermProxyTicket(http: ProxmoxHttpClient, type: "qemu" | "lxc", node: string, vmid: number) {
  return http.post<ConsoleTicket>(`/nodes/${encodeURIComponent(node)}/${type}/${vmid}/termproxy`);
}

export function buildConsoleWebsocketUrl(
  host: string,
  port: number,
  node: string,
  type: "qemu" | "lxc",
  vmid: number,
  vncPort: string,
  vncTicket: string,
): string {
  const encodedTicket = encodeURIComponent(vncTicket);
  return `wss://${host}:${port}/api2/json/nodes/${encodeURIComponent(node)}/${type}/${vmid}/vncwebsocket?port=${vncPort}&vncticket=${encodedTicket}`;
}
