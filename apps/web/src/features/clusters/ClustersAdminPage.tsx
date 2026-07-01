import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClusterRegistry, useConnectedClusters, useDeleteCluster } from "@/hooks/useClusters";
import { AddClusterForm } from "@/features/clusters/AddClusterForm";
import { ConnectClusterDialog } from "@/features/clusters/ConnectClusterDialog";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function ClustersAdminPage() {
  const { user } = useAuth();
  const registryQuery = useClusterRegistry();
  const connectedQuery = useConnectedClusters();
  const deleteCluster = useDeleteCluster();

  const connectedMap = new Map((connectedQuery.data ?? []).map((c) => [c.id, c.connected]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Registered clusters</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Session</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {registryQuery.data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.host}:{c.port}</TableCell>
                  <TableCell>
                    {connectedMap.get(c.id) ? (
                      <Badge variant="success">connected</Badge>
                    ) : (
                      <Badge variant="secondary">not connected</Badge>
                    )}
                  </TableCell>
                  <TableCell className="flex justify-end gap-2">
                    {!connectedMap.get(c.id) && <ConnectClusterDialog clusterId={c.id} defaultRealm={c.defaultRealm} />}
                    {user?.isAppAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Remove cluster "${c.name}" from the registry?`)) return;
                          deleteCluster.mutate(c.id, {
                            onSuccess: () => toast.success("Cluster removed"),
                            onError: (err) => toast.error(err instanceof ApiError ? err.message : "Failed to remove"),
                          });
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {registryQuery.data?.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No clusters registered yet.</p>
          )}
        </CardContent>
      </Card>

      {user?.isAppAdmin ? (
        <Card>
          <CardHeader><CardTitle>Register a new cluster</CardTitle></CardHeader>
          <CardContent>
            <AddClusterForm onCreated={() => registryQuery.refetch()} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Only app-admins can register or remove clusters.</p>
      )}
    </div>
  );
}
