import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSdnVnet } from "@/hooks/useNetwork";
import { ApiError } from "@/lib/api";

export function CreateSdnVnetDialog({ clusterId, zones }: { clusterId: string; zones: string[] }) {
  const [open, setOpen] = React.useState(false);
  const [vnet, setVnet] = React.useState("");
  const [zone, setZone] = React.useState(zones[0] ?? "");
  const [tag, setTag] = React.useState<number | undefined>(undefined);
  const create = useCreateSdnVnet();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ clusterId, vnet, zone, tag });
      toast.success(`VNet "${vnet}" created`);
      setOpen(false);
      setVnet("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create VNet");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={zones.length === 0}>Create VNet</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create SDN VNet</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label>VNet ID</Label>
            <Input value={vnet} onChange={(e) => setVnet(e.target.value)} placeholder="vnet1" maxLength={8} required />
          </div>
          <div className="space-y-1">
            <Label>Zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>VLAN tag</Label>
            <Input type="number" value={tag ?? ""} onChange={(e) => setTag(e.target.value ? Number(e.target.value) : undefined)} placeholder="optional" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
