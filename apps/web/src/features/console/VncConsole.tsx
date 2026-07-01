import * as React from "react";
// @ts-expect-error -- @novnc/novnc ships untyped ESM source; its package.json "exports" maps the
// bare specifier directly to core/rfb.js (no subpath import is exposed).
import RFB from "@novnc/novnc";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function VncConsole({ wsUrl, ticketUrl }: { wsUrl: string; ticketUrl: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const rfbRef = React.useRef<InstanceType<typeof RFB> | null>(null);
  const [status, setStatus] = React.useState("connecting");

  React.useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let rfb: InstanceType<typeof RFB> | null = null;
    let onConnect: () => void;
    let onDisconnect: (ev: CustomEvent<{ clean: boolean }>) => void;

    // Real Proxmox VNC displays require "VNC Authentication" using the vncproxy ticket as the
    // password, so we must fetch that ticket (bound server-side to this exact tunnel) before
    // opening the RFB connection and hand it to noVNC as credentials.
    apiFetch<{ ticket: string }>(ticketUrl)
      .then(({ ticket }) => {
        if (cancelled || !containerRef.current) return;
        rfb = new RFB(containerRef.current, wsUrl, { credentials: { password: ticket } });
        rfb.scaleViewport = true;
        rfb.resizeSession = true;
        rfbRef.current = rfb;
        onConnect = () => setStatus("connected");
        onDisconnect = (ev) => {
          setStatus(ev.detail.clean ? "disconnected" : "disconnected unexpectedly — check server logs for the reason");
          rfbRef.current = null;
        };
        rfb.addEventListener("connect", onConnect);
        rfb.addEventListener("disconnect", onDisconnect as EventListener);
      })
      .catch((err) => {
        if (!cancelled) setStatus(`failed to start: ${err instanceof Error ? err.message : "unknown error"}`);
      });

    return () => {
      cancelled = true;
      rfbRef.current = null;
      if (rfb) {
        rfb.removeEventListener("connect", onConnect);
        rfb.removeEventListener("disconnect", onDisconnect as EventListener);
        rfb.disconnect();
      }
    };
  }, [wsUrl, ticketUrl]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Status: {status}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={status !== "connected"}
          onClick={() => rfbRef.current?.sendCtrlAltDel()}
        >
          Send Ctrl+Alt+Del
        </Button>
      </div>
      <div ref={containerRef} className="h-[560px] w-full overflow-hidden rounded-md bg-black" />
    </div>
  );
}
