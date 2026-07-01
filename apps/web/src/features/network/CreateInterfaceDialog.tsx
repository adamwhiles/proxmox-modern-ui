import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateNetworkInterface } from "@/hooks/useNetwork";
import { ApiError } from "@/lib/api";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CreateInterfaceDialog({ clusterId, node }: { clusterId: string; node: string }) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"bridge" | "vlan">("bridge");
  const [iface, setIface] = React.useState("vmbr1");
  const [bridgePorts, setBridgePorts] = React.useState("");
  const [vlanRawDevice, setVlanRawDevice] = React.useState("vmbr0");
  const [vlanId, setVlanId] = React.useState(100);
  const [address, setAddress] = React.useState("");
  const [netmask, setNetmask] = React.useState("");
  const [gateway, setGateway] = React.useState("");
  const [autostart, setAutostart] = React.useState(true);
  const create = useCreateNetworkInterface();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const common = { clusterId, node, iface, autostart, address: address || undefined, netmask: netmask || undefined, gateway: gateway || undefined };
    const input =
      kind === "bridge"
        ? { ...common, type: "bridge" as const, bridgePorts: bridgePorts || undefined, vlanAware: false }
        : { ...common, type: "vlan" as const, vlanRawDevice, vlanId };
    try {
      await create.mutateAsync(input);
      toast.success(`Interface ${iface} created (pending — apply to activate)`);
      setOpen(false);
      setIface(kind === "bridge" ? "vmbr2" : "vmbr0.101");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create interface");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create interface</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create network interface</DialogTitle></DialogHeader>
        <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <TabsList>
            <TabsTrigger value="bridge">Linux Bridge</TabsTrigger>
            <TabsTrigger value="vlan">Linux VLAN</TabsTrigger>
          </TabsList>
        </Tabs>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Name">
            <Input value={iface} onChange={(e) => setIface(e.target.value)} required />
          </Field>
          {kind === "bridge" ? (
            <Field label="Bridge ports">
              <Input value={bridgePorts} onChange={(e) => setBridgePorts(e.target.value)} placeholder="eth1" />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Raw device">
                <Input value={vlanRawDevice} onChange={(e) => setVlanRawDevice(e.target.value)} required />
              </Field>
              <Field label="VLAN ID">
                <Input type="number" min={1} max={4094} value={vlanId} onChange={(e) => setVlanId(Number(e.target.value))} required />
              </Field>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="IP address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="optional" /></Field>
            <Field label="Netmask"><Input value={netmask} onChange={(e) => setNetmask(e.target.value)} placeholder="255.255.255.0" /></Field>
            <Field label="Gateway"><Input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="optional" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autostart} onChange={(e) => setAutostart(e.target.checked)} />
            Autostart
          </label>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
