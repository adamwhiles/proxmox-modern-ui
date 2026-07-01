import type { ProxmoxHttpClient } from "../http.js";

export interface ConsoleTicket {
  port: string;
  ticket: string;
  /** Only present for termproxy (shell) sessions. */
  upid?: string;
}

/**
 * Real Proxmox loads its console in an iframe pointed at `/?console=...&(novnc|xtermjs)=1&...`, so
 * every request that iframe makes — the ticket POST *and* the vncwebsocket upgrade itself — carries
 * this same Referer. It's more than cosmetic: /termproxy uses it to decide whether to speak the
 * text protocol xterm.js expects at all. Mirroring the exact shape (see pve-manager's
 * VNCConsole.js — `queryDict = { console, vmid, node, cmd, 'cmd-opts', resize }` with empty keys
 * stripped) rather than approximating it, since deviations here mean the wrong protocol mode.
 */
export function buildConsoleReferer(
  host: string,
  port: number,
  type: "qemu" | "lxc",
  node: string,
  vmid: number,
  mode: "xtermjs" | "novnc",
): string {
  const consoleType = type === "qemu" ? "kvm" : "lxc";
  const params = new URLSearchParams({ console: consoleType, vmid: String(vmid), node });
  params.set(mode, "1");
  return `https://${host}:${port}/?${params.toString()}`;
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
 *
 * Critically, /termproxy decides whether to speak the text protocol xterm.js expects (vs. its
 * other console mode) based on the *Referer* header of THIS ticket request — see buildConsoleReferer.
 */
export function getTermProxyTicket(http: ProxmoxHttpClient, type: "qemu" | "lxc", node: string, vmid: number) {
  const url = new URL(http.baseUrl.replace("/api2/json", ""));
  const referer = buildConsoleReferer(url.hostname, Number(url.port || 8006), type, node, vmid, "xtermjs");
  return http.post<ConsoleTicket>(`/nodes/${encodeURIComponent(node)}/${type}/${vmid}/termproxy`, undefined, {
    Referer: referer,
  });
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
