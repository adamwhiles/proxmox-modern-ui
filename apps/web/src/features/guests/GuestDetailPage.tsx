import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuestActionsMenu } from "@/features/guests/GuestActionsMenu";
import { GuestConfigEditor } from "@/features/guests/GuestConfigEditor";
import { GuestStats } from "@/features/guests/GuestStats";
import { VncConsole } from "@/features/console/VncConsole";
import { ShellConsole } from "@/features/console/ShellConsole";
import { useGuestConfig, useGuestSnapshots, type GuestType } from "@/hooks/useGuests";
import { apiPost, apiDelete, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

function buildConsoleUrl(clusterId: string, node: string, type: GuestType, vmid: string, kind: "vnc" | "shell") {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/api/clusters/${clusterId}/nodes/${node}/${type}/${vmid}/console/${kind}`;
}

export function GuestDetailPage() {
  const { clusterId, node, type, vmid } = useParams<{ clusterId: string; node: string; type: GuestType; vmid: string }>();
  const queryClient = useQueryClient();
  const [snapName, setSnapName] = React.useState("");

  const configQuery = useGuestConfig(clusterId!, node!, type as GuestType, Number(vmid));
  const snapshotsQuery = useGuestSnapshots(clusterId!, node!, type as GuestType, Number(vmid));

  if (!clusterId || !node || !type || !vmid) return null;

  async function createSnapshot(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiPost(`/clusters/${clusterId}/nodes/${node}/${type}/${vmid}/snapshots`, { name: snapName });
      toast.success("Snapshot created");
      setSnapName("");
      queryClient.invalidateQueries({ queryKey: ["guest", clusterId, node, type, Number(vmid), "snapshots"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create snapshot");
    }
  }

  async function deleteSnapshot(name: string) {
    try {
      await apiDelete(`/clusters/${clusterId}/nodes/${node}/${type}/${vmid}/snapshots/${encodeURIComponent(name)}`);
      toast.success("Snapshot deleted");
      queryClient.invalidateQueries({ queryKey: ["guest", clusterId, node, type, Number(vmid), "snapshots"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete snapshot");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{type?.toUpperCase()} {vmid}</h1>
            <p className="text-sm text-muted-foreground">{node} · {clusterId}</p>
          </div>
        </div>
        <GuestActionsMenu clusterId={clusterId} node={node} type={type as GuestType} vmid={Number(vmid)} />
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          <GuestStats clusterId={clusterId} node={node} type={type as GuestType} vmid={Number(vmid)} />
        </TabsContent>

        <TabsContent value="console">
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue={type === "qemu" ? "vnc" : "shell"}>
                <TabsList>
                  {type === "qemu" && <TabsTrigger value="vnc">Display (VNC)</TabsTrigger>}
                  <TabsTrigger value="shell">Shell</TabsTrigger>
                </TabsList>
                {type === "qemu" && (
                  <TabsContent value="vnc">
                    <VncConsole wsUrl={buildConsoleUrl(clusterId, node, type as GuestType, vmid, "vnc")} />
                  </TabsContent>
                )}
                <TabsContent value="shell">
                  <ShellConsole wsUrl={buildConsoleUrl(clusterId, node, type as GuestType, vmid, "shell")} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <GuestConfigEditor
            clusterId={clusterId}
            node={node}
            type={type as GuestType}
            vmid={Number(vmid)}
            config={configQuery.data}
            isLoading={configQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="snapshots">
          <Card>
            <CardHeader><CardTitle>Snapshots</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form className="flex gap-2" onSubmit={createSnapshot}>
                <Input placeholder="snapshot name" value={snapName} onChange={(e) => setSnapName(e.target.value)} required />
                <Button type="submit">Create</Button>
              </form>
              {snapshotsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ul className="divide-y">
                  {snapshotsQuery.data
                    ?.filter((s) => s.name !== "current")
                    .map((s) => (
                      <li key={s.name} className="flex items-center justify-between py-2 text-sm">
                        <span>{s.name}{s.description ? ` — ${s.description}` : ""}</span>
                        <Button variant="ghost" size="sm" onClick={() => deleteSnapshot(s.name)}>Delete</Button>
                      </li>
                    ))}
                  {snapshotsQuery.data?.filter((s) => s.name !== "current").length === 0 && (
                    <p className="py-2 text-sm text-muted-foreground">No snapshots yet.</p>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
