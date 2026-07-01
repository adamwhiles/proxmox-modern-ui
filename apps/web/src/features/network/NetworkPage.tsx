import * as React from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardResources } from "@/hooks/useDashboard";
import {
  useNodeNetworkInterfaces,
  useDeleteNetworkInterface,
  useApplyNetworkConfig,
  useSdnZones,
  useSdnVnets,
  useDeleteSdnZone,
  useDeleteSdnVnet,
  useApplySdnConfig,
} from "@/hooks/useNetwork";
import { CreateInterfaceDialog } from "@/features/network/CreateInterfaceDialog";
import { CreateSdnZoneDialog } from "@/features/network/CreateSdnZoneDialog";
import { CreateSdnVnetDialog } from "@/features/network/CreateSdnVnetDialog";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";

export function NetworkPage() {
  const { user } = useAuth();
  const { data } = useDashboardResources();
  const nodes = (data?.resources ?? []).filter((r) => r.type === "node");
  const [clusterId, setClusterId] = React.useState("");
  const [node, setNode] = React.useState("");

  React.useEffect(() => {
    const first = nodes[0];
    if (!clusterId && first) {
      setClusterId(first.clusterId);
      setNode(first.node ?? "");
    }
  }, [nodes, clusterId]);

  const ifaceQuery = useNodeNetworkInterfaces(clusterId, node);
  const deleteIface = useDeleteNetworkInterface();
  const applyNetwork = useApplyNetworkConfig();

  const zonesQuery = useSdnZones(clusterId);
  const vnetsQuery = useSdnVnets(clusterId);
  const deleteZone = useDeleteSdnZone();
  const deleteVnet = useDeleteSdnVnet();
  const applySdn = useApplySdnConfig();

  const pendingChanges = ifaceQuery.data?.some((i) => i.pending !== undefined) ?? false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Network interfaces</CardTitle>
            {pendingChanges && <p className="text-xs text-amber-500">Pending changes — apply to activate</p>}
          </div>
          <div className="flex gap-2">
            <Select value={clusterId} onValueChange={(v) => { setClusterId(v); setNode(""); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Cluster" /></SelectTrigger>
              <SelectContent>
                {[...new Set(nodes.map((n) => n.clusterId))].map((id) => (
                  <SelectItem key={id} value={id}>{nodes.find((n) => n.clusterId === id)?.clusterName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={node} onValueChange={setNode}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Node" /></SelectTrigger>
              <SelectContent>
                {nodes.filter((n) => n.clusterId === clusterId).map((n) => (
                  <SelectItem key={n.node} value={n.node ?? ""}>{n.node}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {user?.isAppAdmin && clusterId && node && <CreateInterfaceDialog clusterId={clusterId} node={node} />}
            {user?.isAppAdmin && clusterId && node && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  applyNetwork.mutate(
                    { clusterId, node },
                    {
                      onSuccess: () => toast.success("Network configuration applied"),
                      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Apply failed"),
                    },
                  );
                }}
                disabled={applyNetwork.isPending}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Apply
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interface</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Address</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ifaceQuery.data?.map((n) => (
                <TableRow key={String(n.iface)}>
                  <TableCell className="font-medium">{String(n.iface)}</TableCell>
                  <TableCell>{String(n.type)}</TableCell>
                  <TableCell>{n.active ? <Badge variant="success">yes</Badge> : <Badge variant="secondary">no</Badge>}</TableCell>
                  <TableCell>{String(n.address ?? "-")}</TableCell>
                  <TableCell className="text-right">
                    {user?.isAppAdmin && !["lo"].includes(String(n.iface)) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Delete interface ${n.iface}?`)) return;
                          deleteIface.mutate(
                            { clusterId, node, iface: String(n.iface) },
                            {
                              onSuccess: () => toast.success("Interface deleted (pending — apply to activate)"),
                              onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
                            },
                          );
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {ifaceQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No interfaces found.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>SDN Zones</CardTitle>
          <div className="flex gap-2">
            {user?.isAppAdmin && <CreateSdnZoneDialog clusterId={clusterId} />}
            {user?.isAppAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  applySdn.mutate(clusterId, {
                    onSuccess: () => toast.success("SDN configuration applied"),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Apply failed"),
                  })
                }
                disabled={applySdn.isPending}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Apply SDN
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Bridge</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {zonesQuery.data?.map((z) => (
                <TableRow key={String(z.zone)}>
                  <TableCell className="font-medium">{String(z.zone)}</TableCell>
                  <TableCell>{String(z.type)}</TableCell>
                  <TableCell>{String(z.bridge ?? "-")}</TableCell>
                  <TableCell className="text-right">
                    {user?.isAppAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Delete zone ${z.zone}?`)) return;
                          deleteZone.mutate(
                            { clusterId, zone: String(z.zone) },
                            {
                              onSuccess: () => toast.success("Zone deleted"),
                              onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
                            },
                          );
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {zonesQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No SDN zones configured.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>SDN VNets</CardTitle>
          {user?.isAppAdmin && (
            <CreateSdnVnetDialog clusterId={clusterId} zones={(zonesQuery.data ?? []).map((z) => String(z.zone))} />
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VNet</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vnetsQuery.data?.map((v) => (
                <TableRow key={String(v.vnet)}>
                  <TableCell className="font-medium">{String(v.vnet)}</TableCell>
                  <TableCell>{String(v.zone)}</TableCell>
                  <TableCell>{String(v.tag ?? "-")}</TableCell>
                  <TableCell className="text-right">
                    {user?.isAppAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Delete VNet ${v.vnet}?`)) return;
                          deleteVnet.mutate(
                            { clusterId, vnet: String(v.vnet) },
                            {
                              onSuccess: () => toast.success("VNet deleted"),
                              onError: (err) => toast.error(err instanceof ApiError ? err.message : "Delete failed"),
                            },
                          );
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {vnetsQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No SDN VNets configured.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
