import * as React from "react";
import { toast } from "sonner";
import { SdnZoneTypeSchema } from "@proxmox-ui/shared";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSdnZone } from "@/hooks/useNetwork";
import { ApiError } from "@/lib/api";

export function CreateSdnZoneDialog({ clusterId }: { clusterId: string }) {
  const [open, setOpen] = React.useState(false);
  const [zone, setZone] = React.useState("");
  const [type, setType] = React.useState<"simple" | "vlan">("simple");
  const [bridge, setBridge] = React.useState("");
  const create = useCreateSdnZone();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ clusterId, zone, type, bridge: bridge || undefined });
      toast.success(`Zone "${zone}" created`);
      setOpen(false);
      setZone("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create zone");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Create zone</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create SDN zone</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label>Zone ID</Label>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="zone1" maxLength={8} required />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SdnZoneTypeSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {type === "vlan" && (
            <div className="space-y-1">
              <Label>Bridge</Label>
              <Input value={bridge} onChange={(e) => setBridge(e.target.value)} placeholder="vmbr0" required />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
