import * as React from "react";
// @ts-expect-error -- @novnc/novnc ships untyped ESM source; its package.json "exports" maps the
// bare specifier directly to core/rfb.js (no subpath import is exposed).
import RFB from "@novnc/novnc";

export function VncConsole({ wsUrl }: { wsUrl: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [status, setStatus] = React.useState("connecting");

  React.useEffect(() => {
    if (!containerRef.current) return;
    const rfb = new RFB(containerRef.current, wsUrl);
    rfb.scaleViewport = true;
    rfb.resizeSession = true;
    const onConnect = () => setStatus("connected");
    const onDisconnect = (ev: CustomEvent<{ clean: boolean }>) =>
      setStatus(ev.detail.clean ? "disconnected" : "disconnected unexpectedly — check the Shell tab or server logs for the reason");
    rfb.addEventListener("connect", onConnect);
    rfb.addEventListener("disconnect", onDisconnect as EventListener);
    return () => {
      rfb.removeEventListener("connect", onConnect);
      rfb.removeEventListener("disconnect", onDisconnect as EventListener);
      rfb.disconnect();
    };
  }, [wsUrl]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Status: {status}</p>
      <div ref={containerRef} className="h-[560px] w-full overflow-hidden rounded-md bg-black" />
    </div>
  );
}
