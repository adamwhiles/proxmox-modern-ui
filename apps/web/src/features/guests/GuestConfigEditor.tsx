import * as React from "react";
import { toast } from "sonner";
import { QemuCpuTypeSchema, type UpdateLxcConfigInput, type UpdateQemuConfigInput } from "@proxmox-ui/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateGuestConfig, type GuestType } from "@/hooks/useGuests";
import { ApiError } from "@/lib/api";

interface Props {
  clusterId: string;
  node: string;
  type: GuestType;
  vmid: number;
  config: Record<string, unknown> | undefined;
  isLoading: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Finds the primary disk's Proxmox config key (e.g. "scsi0") and its size in GiB, skipping any CD-ROM entry. */
function findPrimaryDisk(config: Record<string, unknown>): { key: string; sizeGiB: number | null } | null {
  const busPrefixes = ["scsi", "sata", "virtio", "ide"];
  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== "string") continue;
    if (value.includes("media=cdrom")) continue;
    if (busPrefixes.some((p) => key.startsWith(p) && /\d+$/.test(key))) {
      const match = value.match(/size=(\d+)G/);
      return { key, sizeGiB: match ? Number(match[1]) : null };
    }
  }
  return null;
}

function findRootfsSize(config: Record<string, unknown>): number | null {
  const rootfs = config.rootfs;
  if (typeof rootfs !== "string") return null;
  const match = rootfs.match(/size=(\d+)G/);
  return match ? Number(match[1]) : null;
}

export function GuestConfigEditor({ clusterId, node, type, vmid, config, isLoading }: Props) {
  const update = useUpdateGuestConfig();

  const [name, setName] = React.useState("");
  const [cores, setCores] = React.useState(1);
  const [sockets, setSockets] = React.useState(1);
  const [cpuType, setCpuType] = React.useState("x86-64-v2-AES");
  const [memoryMiB, setMemoryMiB] = React.useState(512);
  const [balloonMiB, setBalloonMiB] = React.useState(0);
  const [swapMiB, setSwapMiB] = React.useState(512);
  const [qemuAgent, setQemuAgent] = React.useState(true);
  const [onboot, setOnboot] = React.useState(false);
  const [tags, setTags] = React.useState("");
  const [diskGiB, setDiskGiB] = React.useState<number | null>(null);
  const [diskKey, setDiskKey] = React.useState<string>("scsi0");
  const [currentDiskGiB, setCurrentDiskGiB] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!config) return;
    setName(String(config.name ?? config.hostname ?? ""));
    setCores(Number(config.cores ?? 1));
    setSockets(Number(config.sockets ?? 1));
    setCpuType(String(config.cpu ?? "x86-64-v2-AES"));
    setMemoryMiB(Number(config.memory ?? 512));
    setBalloonMiB(Number(config.balloon ?? 0));
    setSwapMiB(Number(config.swap ?? 512));
    setQemuAgent(String(config.agent ?? "0").startsWith("1"));
    setOnboot(String(config.onboot ?? "0") === "1");
    setTags(String(config.tags ?? ""));

    if (type === "qemu") {
      const disk = findPrimaryDisk(config);
      if (disk) {
        setDiskKey(disk.key);
        setCurrentDiskGiB(disk.sizeGiB);
        setDiskGiB(disk.sizeGiB);
      }
    } else {
      const size = findRootfsSize(config);
      setCurrentDiskGiB(size);
      setDiskGiB(size);
    }
  }, [config, type]);

  async function handleSave() {
    const growingDisk = diskGiB !== null && currentDiskGiB !== null && diskGiB > currentDiskGiB;
    try {
      if (type === "qemu") {
        const input: UpdateQemuConfigInput = {
          name,
          cores,
          sockets,
          cpuType: cpuType as UpdateQemuConfigInput["cpuType"],
          memoryMiB,
          balloonMiB,
          qemuAgent,
          onboot,
          tags,
          ...(growingDisk ? { diskResizeGiB: diskGiB!, diskKey } : {}),
        };
        await update.mutateAsync({ clusterId, node, type, vmid, input });
      } else {
        const input: UpdateLxcConfigInput = {
          hostname: name,
          cores,
          memoryMiB,
          swapMiB,
          onboot,
          ...(growingDisk ? { diskResizeGiB: diskGiB! } : {}),
        };
        await update.mutateAsync({ clusterId, node, type, vmid, input });
      }
      toast.success("Configuration updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update configuration");
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">General</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label={type === "qemu" ? "Name" : "Hostname"}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {type === "qemu" && (
            <Field label="Tags">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="prod;web" />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" checked={onboot} onChange={(e) => setOnboot(e.target.checked)} />
            Start at boot
          </label>
          {type === "qemu" && (
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input type="checkbox" checked={qemuAgent} onChange={(e) => setQemuAgent(e.target.checked)} />
              QEMU Guest Agent
            </label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">CPU & Memory</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {type === "qemu" && (
            <Field label="Sockets">
              <Input type="number" min={1} max={4} value={sockets} onChange={(e) => setSockets(Number(e.target.value))} />
            </Field>
          )}
          <Field label="Cores">
            <Input type="number" min={1} value={cores} onChange={(e) => setCores(Number(e.target.value))} />
          </Field>
          {type === "qemu" && (
            <Field label="CPU type">
              <Select value={cpuType} onValueChange={setCpuType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QemuCpuTypeSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Memory (MiB)">
            <Input type="number" min={16} value={memoryMiB} onChange={(e) => setMemoryMiB(Number(e.target.value))} />
          </Field>
          {type === "qemu" ? (
            <Field label="Balloon (min MiB, 0 = disabled)">
              <Input type="number" min={0} value={balloonMiB} onChange={(e) => setBalloonMiB(Number(e.target.value))} />
            </Field>
          ) : (
            <Field label="Swap (MiB)">
              <Input type="number" min={0} value={swapMiB} onChange={(e) => setSwapMiB(Number(e.target.value))} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Disk</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label={`Size (GiB)${currentDiskGiB ? ` — current: ${currentDiskGiB}` : ""}`}>
            <Input
              type="number"
              min={currentDiskGiB ?? 1}
              value={diskGiB ?? ""}
              onChange={(e) => setDiskGiB(e.target.value ? Number(e.target.value) : null)}
            />
          </Field>
          <p className="col-span-2 text-xs text-muted-foreground">
            Disks can only be grown online, not shrunk. Saving with a larger value resizes the disk immediately.
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
