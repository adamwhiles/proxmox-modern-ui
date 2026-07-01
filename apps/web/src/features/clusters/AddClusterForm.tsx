import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateCluster, useProbeCluster } from "@/hooks/useClusters";
import type { ClusterProbeResult } from "@proxmox-ui/shared";

export function AddClusterForm({ setupToken, onCreated }: { setupToken?: string; onCreated: () => void }) {
  const [name, setName] = React.useState("");
  const [host, setHost] = React.useState("");
  const [port, setPort] = React.useState(8006);
  const [defaultRealm, setDefaultRealm] = React.useState("pam");
  const [probe, setProbe] = React.useState<ClusterProbeResult | null>(null);

  const probeMutation = useProbeCluster();
  const createMutation = useCreateCluster();

  async function handleProbe(e: React.FormEvent) {
    e.preventDefault();
    setProbe(null);
    try {
      const result = await probeMutation.mutateAsync({ host, port, setupToken });
      setProbe(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reach host");
    }
  }

  async function handleConfirm() {
    if (!probe) return;
    try {
      await createMutation.mutateAsync({
        name: name || host,
        host,
        port,
        defaultRealm,
        tlsFingerprint: probe.tlsFingerprint,
        setupToken,
      });
      toast.success(`Cluster "${name || host}" registered`);
      onCreated();
      setProbe(null);
      setName("");
      setHost("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register cluster");
    }
  }

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={handleProbe}>
        <div className="space-y-2">
          <Label htmlFor="cname">Display name</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Home Lab" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="chost">Host</Label>
            <Input id="chost" value={host} onChange={(e) => setHost(e.target.value)} placeholder="pve.local" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cport">Port</Label>
            <Input id="cport" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="crealm">Default realm</Label>
          <Input id="crealm" value={defaultRealm} onChange={(e) => setDefaultRealm(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary" className="w-full" disabled={probeMutation.isPending || !host}>
          {probeMutation.isPending ? "Probing…" : "Probe certificate"}
        </Button>
      </form>

      {probe && (
        <div className="space-y-3 rounded-md border border-amber-400/50 bg-amber-500/10 p-3 text-sm">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium">Verify this certificate before trusting it</p>
              <p className="text-muted-foreground">
                This fingerprint will be permanently pinned for all future connections to this cluster.
              </p>
            </div>
          </div>
          <dl className="space-y-1 text-xs">
            <div>
              <dt className="inline font-medium">Fingerprint: </dt>
              <dd className="inline break-all font-mono">{probe.tlsFingerprint}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Subject: </dt>
              <dd className="inline">{probe.subject}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Issuer: </dt>
              <dd className="inline">{probe.issuer}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Valid: </dt>
              <dd className="inline">
                {probe.validFrom} – {probe.validTo}
              </dd>
            </div>
          </dl>
          <Button onClick={handleConfirm} className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Registering…" : "Trust & register cluster"}
          </Button>
        </div>
      )}
    </div>
  );
}
