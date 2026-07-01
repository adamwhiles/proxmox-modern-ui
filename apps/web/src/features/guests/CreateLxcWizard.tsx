import * as React from "react";
import { toast } from "sonner";
import type { CreateLxcInput } from "@proxmox-ui/shared";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLxc, useNodeStorage, useStorageContent } from "@/hooks/useGuests";
import { ApiError } from "@/lib/api";

type FormState = Omit<CreateLxcInput, "clusterId" | "node">;

function defaultForm(vmid: number): FormState {
  return {
    vmid,
    hostname: "",
    pool: "",
    unprivileged: true,
    startOnBoot: false,
    password: "",
    ostemplate: "",
    storage: "local-lvm",
    diskGiB: 8,
    cores: 1,
    memoryMiB: 512,
    swapMiB: 512,
    bridge: "vmbr0",
    vlanTag: undefined,
    useDhcp: true,
    ipAddressCidr: "",
    gateway: "",
    firewall: true,
    nameserver: "",
    searchDomain: "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CreateLxcWizard({ clusterId, node }: { clusterId: string; node: string }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("general");
  const [form, setForm] = React.useState<FormState>(() => defaultForm(200));
  const create = useCreateLxc();
  const storageQuery = useNodeStorage(clusterId, node);
  const templateStorages = (storageQuery.data ?? []).filter((s) => String(s.content ?? "").includes("vztmpl"));
  const diskStorages = (storageQuery.data ?? []).filter((s) => String(s.content ?? "").includes("rootdir") || String(s.content ?? "").includes("images"));
  const [templateStorage, setTemplateStorage] = React.useState("");
  const templatesQuery = useStorageContent(clusterId, node, templateStorage, "vztmpl");

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    try {
      await create.mutateAsync({ ...form, clusterId, node });
      toast.success(`Container ${form.vmid} creation started`);
      setOpen(false);
      setForm(defaultForm(form.vmid + 1));
      setTab("general");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create container");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Create LXC</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create container</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="disks">Disks</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="dns">DNS</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="grid grid-cols-2 gap-3">
            <Field label="CT ID">
              <Input type="number" value={form.vmid} onChange={(e) => set("vmid", Number(e.target.value))} />
            </Field>
            <Field label="Hostname">
              <Input value={form.hostname} onChange={(e) => set("hostname", e.target.value)} placeholder="my-container" />
            </Field>
            <Field label="Resource pool">
              <Input value={form.pool} onChange={(e) => set("pool", e.target.value)} placeholder="optional" />
            </Field>
            <Field label="Root password">
              <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={5} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.unprivileged} onChange={(e) => set("unprivileged", e.target.checked)} />
              Unprivileged container
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.startOnBoot} onChange={(e) => set("startOnBoot", e.target.checked)} />
              Start at boot
            </label>
          </TabsContent>

          <TabsContent value="template" className="grid grid-cols-2 gap-3">
            <Field label="Storage">
              <Select value={templateStorage} onValueChange={setTemplateStorage}>
                <SelectTrigger><SelectValue placeholder="Select storage" /></SelectTrigger>
                <SelectContent>
                  {templateStorages.map((s) => (
                    <SelectItem key={String(s.storage)} value={String(s.storage)}>{String(s.storage)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Template">
              <Select value={form.ostemplate} onValueChange={(v) => set("ostemplate", v)} disabled={!templateStorage}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {(templatesQuery.data ?? []).map((t) => (
                    <SelectItem key={t.volid} value={t.volid}>{t.volid.split("/").pop()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
            <Field label="Root disk size (GiB)">
              <Input type="number" min={1} value={form.diskGiB} onChange={(e) => set("diskGiB", Number(e.target.value))} />
            </Field>
          </TabsContent>

          <TabsContent value="resources" className="grid grid-cols-2 gap-3">
            <Field label="Cores">
              <Input type="number" min={1} value={form.cores} onChange={(e) => set("cores", Number(e.target.value))} />
            </Field>
            <div />
            <Field label="Memory (MiB)">
              <Input type="number" min={16} value={form.memoryMiB} onChange={(e) => set("memoryMiB", Number(e.target.value))} />
            </Field>
            <Field label="Swap (MiB)">
              <Input type="number" min={0} value={form.swapMiB} onChange={(e) => set("swapMiB", Number(e.target.value))} />
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.useDhcp} onChange={(e) => set("useDhcp", e.target.checked)} />
              Use DHCP
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.firewall} onChange={(e) => set("firewall", e.target.checked)} />
              Firewall
            </label>
            {!form.useDhcp && (
              <>
                <Field label="IP address (CIDR)">
                  <Input value={form.ipAddressCidr} onChange={(e) => set("ipAddressCidr", e.target.value)} placeholder="192.168.1.50/24" />
                </Field>
                <Field label="Gateway">
                  <Input value={form.gateway} onChange={(e) => set("gateway", e.target.value)} placeholder="192.168.1.1" />
                </Field>
              </>
            )}
          </TabsContent>

          <TabsContent value="dns" className="grid grid-cols-2 gap-3">
            <Field label="DNS server">
              <Input value={form.nameserver} onChange={(e) => set("nameserver", e.target.value)} placeholder="inherit from host" />
            </Field>
            <Field label="Search domain">
              <Input value={form.searchDomain} onChange={(e) => set("searchDomain", e.target.value)} placeholder="inherit from host" />
            </Field>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create container"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
