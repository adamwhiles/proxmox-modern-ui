import * as React from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

/** Proxmox's termproxy wire format for client->server bytes (server->client is raw, unwrapped) —
 * see https://github.com/proxmox/pve-xtermjs. Anything not in one of these three shapes is
 * silently ignored by the real server, so unframed input just does nothing rather than erroring. */
function encodeData(data: string): string {
  return `0:${new TextEncoder().encode(data).length}:${data}`;
}
function encodeResize(cols: number, rows: number): string {
  return `1:${cols}:${rows}:`;
}
const PING = "2";
const PING_INTERVAL_MS = 30_000;

export function ShellConsole({ wsUrl }: { wsUrl: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({ convertEol: true, fontSize: 13 });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => ws.send(encodeResize(term.cols, term.rows));
    ws.onmessage = (ev) => {
      const data = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : ev.data;
      term.write(typeof data === "string" ? data : new TextDecoder().decode(data));
    };
    ws.onclose = (ev) => {
      const reason = ev.reason ? `: ${ev.reason}` : "";
      term.write(`\r\n\x1b[31m[connection closed${reason} (code ${ev.code})]\x1b[0m\r\n`);
    };
    ws.onerror = () => term.write("\r\n\x1b[31m[websocket error — see browser console/network tab]\x1b[0m\r\n");
    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(encodeData(data));
    });

    const pingInterval = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(PING);
    }, PING_INTERVAL_MS);

    const onResize = () => {
      fit.fit();
      if (ws.readyState === WebSocket.OPEN) ws.send(encodeResize(term.cols, term.rows));
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearInterval(pingInterval);
      window.removeEventListener("resize", onResize);
      dataDisposable.dispose();
      ws.close();
      term.dispose();
    };
  }, [wsUrl]);

  return <div ref={containerRef} className="h-[560px] w-full rounded-md bg-black p-2" />;
}
