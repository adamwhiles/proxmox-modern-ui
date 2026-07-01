import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadUrl } from "@/hooks/useStorage";
import { ApiError } from "@/lib/api";

export function DownloadUrlDialog({ clusterId, node, storage }: { clusterId: string; node: string; storage: string }) {
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState<"iso" | "vztmpl">("iso");
  const [filename, setFilename] = React.useState("");
  const [url, setUrl] = React.useState("");
  const download = useDownloadUrl();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await download.mutateAsync({ clusterId, node, storage, content, filename, url });
      toast.success(`Downloading ${filename}…`);
      setOpen(false);
      setFilename("");
      setUrl("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Download from URL</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Download from URL</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label>Content type</Label>
            <Select value={content} onValueChange={(v) => setContent(v as "iso" | "vztmpl")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iso">ISO image</SelectItem>
                <SelectItem value="vztmpl">Container template</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>File name</Label>
            <Input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="debian-12.7-amd64-netinst.iso" required />
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" type="url" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={download.isPending}>{download.isPending ? "Starting…" : "Download"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
