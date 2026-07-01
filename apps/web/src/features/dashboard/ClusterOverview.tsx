import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { ClusterResource } from "@proxmox-ui/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsageBar } from "@/components/UsageBar";
import { useClusterHealth } from "@/hooks/useDashboard";
import { formatBytes, formatUptime } from "@/lib/utils";

export function ClusterOverview({ resources }: { resources: ClusterResource[] }) {
  const { data: health } = useClusterHealth();
  const nodes = resources.filter((r) => r.type === "node");
  const clusterIds = [...new Set(resources.map((r) => r.clusterId))];

  if (clusterIds.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(clusterIds.length, 3)}, minmax(0, 1fr))` }}>
        {clusterIds.map((clusterId) => {
          const clusterNodes = nodes.filter((n) => n.clusterId === clusterId);
          const h = health?.find((x) => x.clusterId === clusterId);
          const totalMem = clusterNodes.reduce((s, n) => s + (n.maxmem ?? 0), 0);
          const usedMem = clusterNodes.reduce((s, n) => s + (n.mem ?? 0), 0);
          const totalDisk = clusterNodes.reduce((s, n) => s + (n.maxdisk ?? 0), 0);
          const usedDisk = clusterNodes.reduce((s, n) => s + (n.disk ?? 0), 0);
          const avgCpu = clusterNodes.length
            ? clusterNodes.reduce((s, n) => s + (n.cpu ?? 0), 0) / clusterNodes.length
            : 0;

          return (
            <Card key={clusterId}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{clusterNodes[0]?.clusterName ?? clusterId}</CardTitle>
                {h ? (
                  h.quorate ? (
                    <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Quorate</Badge>
                  ) : (
                    <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />No quorum</Badge>
                  )
                ) : (
                  <Badge variant="outline"><AlertTriangle className="mr-1 h-3 w-3" />Unknown</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {h ? `${h.onlineNodeCount}/${h.nodeCount} nodes online` : `${clusterNodes.length} node(s)`}
                </p>
                <UsageBar label={`CPU (avg) ${(avgCpu * 100).toFixed(0)}%`} fraction={avgCpu} />
                <UsageBar label={`Memory ${formatBytes(usedMem)} / ${formatBytes(totalMem)}`} fraction={totalMem ? usedMem / totalMem : 0} />
                <UsageBar label={`Disk ${formatBytes(usedDisk)} / ${formatBytes(totalDisk)}`} fraction={totalDisk ? usedDisk / totalDisk : 0} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {nodes.map((node) => (
          <Link key={`${node.clusterId}/${node.node}`} to={`/nodes/${node.clusterId}/${node.node}`}>
            <Card className="transition-colors hover:border-primary">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{node.node}</CardTitle>
                <Badge variant={node.status === "online" ? "success" : "destructive"}>{node.status ?? "unknown"}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <UsageBar label={`CPU ${((node.cpu ?? 0) * 100).toFixed(0)}%`} fraction={node.cpu ?? 0} />
                <UsageBar
                  label={`Mem ${formatBytes(node.mem)} / ${formatBytes(node.maxmem)}`}
                  fraction={node.maxmem ? (node.mem ?? 0) / node.maxmem : 0}
                />
                <UsageBar
                  label={`Disk ${formatBytes(node.disk)} / ${formatBytes(node.maxdisk)}`}
                  fraction={node.maxdisk ? (node.disk ?? 0) / node.maxdisk : 0}
                />
                <p className="text-xs text-muted-foreground">Uptime: {formatUptime(node.uptime)}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
