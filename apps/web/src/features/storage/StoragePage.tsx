import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardResources } from "@/hooks/useDashboard";
import { useClusterStorage, useDeleteStorage, useUpdateStorage, useStorageContentList, useDeleteStorageContent } from "@/hooks/useStorage";
import { CreateStorageDialog } from "@/features/storage/CreateStorageDialog";
import { DownloadUrlDialog } from "@/features/storage/DownloadUrlDialog";
import { ApiError } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export function StoragePage() {
  const { user } = useAuth();
  const { data } = useDashboardResources();
  const nodes = (data?.resources ?? []).filter((r) => r.type === "node");
  const clusterIds = React.useMemo(() => [...new Set(nodes.map((n) => n.clusterId))], [nodes]);
  const [clusterId, setClusterId] = React.useState("");
  const [node, setNode] = React.useState("");
  const [selectedStorage, setSelectedStorage] = React.useState("");

  React.useEffect(() => {
    if (!clusterId && clusterIds[0]) setClusterId(clusterIds[0]);
  }, [clusterIds, clusterId]);
  React.useEffect(() => {
    const first = nodes.find((n) => n.clusterId === clusterId);
    if (clusterId && !node && first?.node) setNode(first.node);
  }, [clusterId, nodes, node]);

  const clusterStorageQuery = useClusterStorage(clusterId);
  const deleteStorage = useDeleteStorage();
  const updateStorage = useUpdateStorage();
  const contentQuery = useStorageContentList(clusterId, node, selectedStorage);
  const deleteContent = useDeleteStorageContent();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Storage</CardTitle>
          <div className="flex gap-2">
            <Select value={clusterId} onValueChange={setClusterId}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Cluster" /></SelectTrigger>
              <SelectContent>
                {clusterIds.map((id) => (
                  <SelectItem key={id} value={id}>{nodes.find((n) => n.clusterId === id)?.clusterName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user?.isAppAdmin && <CreateStorageDialog clusterId={clusterId} />}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Shared</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusterStorageQuery.data?.map((s) => (
                <TableRow key={String(s.storage)}>
                  <TableCell className="font-medium">{String(s.storage)}</TableCell>
                  <TableCell>{String(s.type)}</TableCell>
                  <TableCell className="text-xs">{String(s.content ?? "")}</TableCell>
                  <TableCell>{s.shared ? "yes" : "no"}</TableCell>
                  <TableCell>
                    <Badge variant={s.disable ? "secondary" : "success"}>{s.disable ? "disabled" : "enabled"}</Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    {user?.isAppAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            updateStorage.mutate(
                              { clusterId, storageId: String(s.storage), input: { disable: !s.disable } },
                              {
                                onSuccess: () => toast.success(s.disable ? "Storage enabled" : "Storage disabled"),
                                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Update failed"),
                              },
                            );
                          }}
                        >
                          {s.disable ? "Enable" : "Disable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (!confirm(`Remove storage "${s.storage}" from the cluster configuration?`)) return;
                            deleteStorage.mutate(
                              { clusterId, storageId: String(s.storage) },
                              {
                                onSuccess: () => toast.success("Storage removed"),
                                onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
                              },
                            );
                          }}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {clusterStorageQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No storage configured.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Content browser</CardTitle>
          <div className="flex gap-2">
            <Select value={node} onValueChange={setNode}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Node" /></SelectTrigger>
              <SelectContent>
                {nodes.filter((n) => n.clusterId === clusterId).map((n) => (
                  <SelectItem key={n.node} value={n.node ?? ""}>{n.node}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStorage} onValueChange={setSelectedStorage}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Storage" /></SelectTrigger>
              <SelectContent>
                {clusterStorageQuery.data?.map((s) => (
                  <SelectItem key={String(s.storage)} value={String(s.storage)}>{String(s.storage)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clusterId && node && selectedStorage && (
              <DownloadUrlDialog clusterId={clusterId} node={node} storage={selectedStorage} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedStorage ? (
            <p className="text-sm text-muted-foreground">Select a storage to browse its contents.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volume</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contentQuery.data?.map((c) => (
                  <TableRow key={String(c.volid)}>
                    <TableCell className="font-mono text-xs">{String(c.volid).split("/").pop()}</TableCell>
                    <TableCell>{String(c.content)}</TableCell>
                    <TableCell>{formatBytes(Number(c.size))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Delete ${c.volid}?`)) return;
                          deleteContent.mutate(
                            { clusterId, node, storage: selectedStorage, volid: String(c.volid) },
                            {
                              onSuccess: () => toast.success("Deleted"),
                              onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
                            },
                          );
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {selectedStorage && contentQuery.data?.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No content in this storage.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
