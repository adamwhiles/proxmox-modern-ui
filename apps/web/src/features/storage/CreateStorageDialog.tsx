import * as React from "react";
import { toast } from "sonner";
import { StorageContentTypeSchema, StorageTypeSchema, type StorageType } from "@proxmox-ui/shared";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateStorage } from "@/hooks/useStorage";
import { ApiError } from "@/lib/api";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function CreateStorageDialog({ clusterId }: { clusterId: string }) {
  const [open, setOpen] = React.useState(false);
  const [storageId, setStorageId] = React.useState("");
  const [type, setType] = React.useState<StorageType>("dir");
  const [content, setContent] = React.useState<string[]>(["images"]);
  const [shared, setShared] = React.useState(false);
  const [path, setPath] = React.useState("/mnt/data");
  const [server, setServer] = React.useState("");
  const [exportPath, setExportPath] = React.useState("");
  const [share, setShare] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [vgname, setVgname] = React.useState("");
  const [thinpool, setThinpool] = React.useState("");

  const create = useCreateStorage();

  function toggleContent(c: string) {
    setContent((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = { clusterId, storageId, content: content as never, shared, disable: false };
    const input =
      type === "dir"
        ? { ...base, type: "dir" as const, path }
        : type === "nfs"
          ? { ...base, type: "nfs" as const, server, export: exportPath }
          : type === "cifs"
            ? { ...base, type: "cifs" as const, server, share, username: username || undefined, password: password || undefined }
            : { ...base, type: "lvmthin" as const, vgname, thinpool };

    try {
      await create.mutateAsync(input);
      toast.success(`Storage "${storageId}" created`);
      setOpen(false);
      setStorageId("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create storage");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add storage</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add storage</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Storage ID">
              <Input value={storageId} onChange={(e) => setStorageId(e.target.value)} placeholder="my-storage" required />
            </Field>
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as StorageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {StorageTypeSchema.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {type === "dir" && (
            <Field label="Directory path">
              <Input value={path} onChange={(e) => setPath(e.target.value)} required />
            </Field>
          )}
          {type === "nfs" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Server"><Input value={server} onChange={(e) => setServer(e.target.value)} required /></Field>
              <Field label="Export"><Input value={exportPath} onChange={(e) => setExportPath(e.target.value)} placeholder="/export/data" required /></Field>
            </div>
          )}
          {type === "cifs" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Server"><Input value={server} onChange={(e) => setServer(e.target.value)} required /></Field>
              <Field label="Share"><Input value={share} onChange={(e) => setShare(e.target.value)} required /></Field>
              <Field label="Username"><Input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
              <Field label="Password"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            </div>
          )}
          {type === "lvmthin" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Volume group"><Input value={vgname} onChange={(e) => setVgname(e.target.value)} required /></Field>
              <Field label="Thin pool"><Input value={thinpool} onChange={(e) => setThinpool(e.target.value)} required /></Field>
            </div>
          )}

          <div className="space-y-1">
            <Label>Content types</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              {StorageContentTypeSchema.options.map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={content.includes(c)} onChange={() => toggleContent(c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            Shared across all nodes
          </label>

          <DialogFooter>
            <Button type="submit" disabled={create.isPending || content.length === 0}>
              {create.isPending ? "Creating…" : "Add storage"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
