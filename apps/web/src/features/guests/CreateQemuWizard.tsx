import * as React from "react";
import { toast } from "sonner";
import {
  QemuBiosSchema,
  QemuMachineSchema,
  QemuScsiHwSchema,
  QemuDiskBusSchema,
  QemuDiskCacheSchema,
  QemuCpuTypeSchema,
  QemuNetModelSchema,
  type CreateQemuInput,
} from "@proxmox-ui/shared";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateQemu, useNodeStorage, useStorageContent } from "@/hooks/useGuests";
import { ApiError } from "@/lib/api";

type FormState = Omit<CreateQemuInput, "clusterId" | "node">;

function defaultForm(vmid: number): FormState {
  return {
    vmid,
    name: "",
    pool: "",
    tags: "",
    startOnBoot: false,
    ostype: "l26",
    isoStorage: "",
    isoFile: "",
    bios: "seabios",
    machine: "pc",
    scsihw: "virtio-scsi-pci",
    qemuAgent: true,
    storage: "local-lvm",
    diskGiB: 32,
    diskBus: "scsi",
    diskCache: "none",
    ssdEmulation: false,
    discard: false,
    ioThread: true,
    sockets: 1,
    cores: 2,
    cpuType: "x86-64-v2-AES",
    memoryMiB: 2048,
    balloonMiB: 0,
    bridge: "vmbr0",
    vlanTag: undefined,
    netModel: "virtio",
    firewall: true,
  };
}

const OS_TYPES = [
  { value: "l26", label: "Linux 6.x - 2.6 Kernel" },
  { value: "win11", label: "Windows 11/2022" },
  { value: "win10", label: "Windows 10/2016/2019" },
  { value: "other", label: "Other" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CreateQemuWizard({ clusterId, node }: { clusterId: string; node: string }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("general");
  const [form, setForm] = React.useState<FormState>(() => defaultForm(100));
  const create = useCreateQemu();
  const storageQuery = useNodeStorage(clusterId, node);
  const isoQuery = useStorageContent(clusterId, node, form.isoStorage || "", "iso");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    try {
      await create.mutateAsync({ ...form, clusterId, node });
      toast.success(`VM ${form.vmid} creation started`);
      setOpen(false);
      setForm(defaultForm(form.vmid + 1));
      setTab("general");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create VM");
    }
  }

  const diskStorages = (storageQuery.data ?? []).filter((s) => String(s.content ?? "").includes("images"));
  const isoStorages = (storageQuery.data ?? []).filter((s) => String(s.content ?? "").includes("iso"));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create VM</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create virtual machine</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-7">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="os">OS</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="disks">Disks</TabsTrigger>
            <TabsTrigger value="cpu">CPU</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="grid grid-cols-2 gap-3">
            <Field label="VM ID">
              <Input type="number" value={form.vmid} onChange={(e) => set("vmid", Number(e.target.value))} />
            </Field>
            <Field label="Name">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="my-vm" />
            </Field>
            <Field label="Resource pool">
              <Input value={form.pool} onChange={(e) => set("pool", e.target.value)} placeholder="optional" />
            </Field>
            <Field label="Tags">
              <Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="prod;web" />
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.startOnBoot} onChange={(e) => set("startOnBoot", e.target.checked)} />
              Start at boot
            </label>
          </TabsContent>

          <TabsContent value="os" className="grid grid-cols-2 gap-3">
            <Field label="Guest OS type">
              <Select value={form.ostype} onValueChange={(v) => set("ostype", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OS_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div />
            <Field label="ISO storage">
              <Select value={form.isoStorage} onValueChange={(v) => set("isoStorage", v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {isoStorages.map((s) => (
                    <SelectItem key={String(s.storage)} value={String(s.storage)}>{String(s.storage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ISO image">
              <Select value={form.isoFile} onValueChange={(v) => set("isoFile", v)} disabled={!form.isoStorage}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {(isoQuery.data ?? []).map((c) => {
                    const fileName = c.volid.split("/").pop() ?? c.volid;
                    return <SelectItem key={c.volid} value={fileName}>{fileName}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </Field>
          </TabsContent>

          <TabsContent value="system" className="grid grid-cols-2 gap-3">
            <Field label="BIOS">
              <Select value={form.bios} onValueChange={(v) => set("bios", v as FormState["bios"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuBiosSchema.options.map((o) => <SelectItem key={o} value={o}>{o.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Machine type">
              <Select value={form.machine} onValueChange={(v) => set("machine", v as FormState["machine"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuMachineSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="SCSI controller">
              <Select value={form.scsihw} onValueChange={(v) => set("scsihw", v as FormState["scsihw"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuScsiHwSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={form.qemuAgent} onChange={(e) => set("qemuAgent", e.target.checked)} />
              QEMU Guest Agent
            </label>
          </TabsContent>

          <TabsContent value="disks" className="grid grid-cols-2 gap-3">
            <Field label="Storage">
              <Select value={form.storage} onValueChange={(v) => set("storage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {diskStorages.map((s) => (
                    <SelectItem key={String(s.storage)} value={String(s.storage)}>{String(s.storage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Disk size (GiB)">
              <Input type="number" min={1} value={form.diskGiB} onChange={(e) => set("diskGiB", Number(e.target.value))} />
            </Field>
            <Field label="Bus/Device">
              <Select value={form.diskBus} onValueChange={(v) => set("diskBus", v as FormState["diskBus"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuDiskBusSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cache">
              <Select value={form.diskCache} onValueChange={(v) => set("diskCache", v as FormState["diskCache"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuDiskCacheSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ssdEmulation} onChange={(e) => set("ssdEmulation", e.target.checked)} />
                SSD emulation
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.discard} onChange={(e) => set("discard", e.target.checked)} />
                Discard
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ioThread} onChange={(e) => set("ioThread", e.target.checked)} />
                IO thread
              </label>
            </div>
          </TabsContent>

          <TabsContent value="cpu" className="grid grid-cols-2 gap-3">
            <Field label="Sockets">
              <Input type="number" min={1} max={4} value={form.sockets} onChange={(e) => set("sockets", Number(e.target.value))} />
            </Field>
            <Field label="Cores">
              <Input type="number" min={1} value={form.cores} onChange={(e) => set("cores", Number(e.target.value))} />
            </Field>
            <Field label="Type">
              <Select value={form.cpuType} onValueChange={(v) => set("cpuType", v as FormState["cpuType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuCpuTypeSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="text-xs text-muted-foreground self-end pb-2">
              Total vCPUs: {form.sockets * form.cores}
            </div>
          </TabsContent>

          <TabsContent value="memory" className="grid grid-cols-2 gap-3">
            <Field label="Memory (MiB)">
              <Input type="number" min={16} value={form.memoryMiB} onChange={(e) => set("memoryMiB", Number(e.target.value))} />
            </Field>
            <Field label="Minimum memory / ballooning (MiB, 0 = disabled)">
              <Input type="number" min={0} value={form.balloonMiB} onChange={(e) => set("balloonMiB", Number(e.target.value))} />
            </Field>
          </TabsContent>

          <TabsContent value="network" className="grid grid-cols-2 gap-3">
            <Field label="Bridge">
              <Input value={form.bridge} onChange={(e) => set("bridge", e.target.value)} />
            </Field>
            <Field label="VLAN tag">
              <Input
                type="number"
                value={form.vlanTag ?? ""}
                onChange={(e) => set("vlanTag", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="none"
              />
            </Field>
            <Field label="Model">
              <Select value={form.netModel} onValueChange={(v) => set("netModel", v as FormState["netModel"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuNetModelSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={form.firewall} onChange={(e) => set("firewall", e.target.checked)} />
              Firewall
            </label>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create VM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
