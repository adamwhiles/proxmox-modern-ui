import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardResources } from "@/hooks/useDashboard";
import { apiFetch } from "@/lib/api";

export function BackupsPage() {
  const { data } = useDashboardResources();
  const clusterIds = React.useMemo(
    () => [...new Set((data?.resources ?? []).map((r) => r.clusterId))],
    [data],
  );
  const [clusterId, setClusterId] = React.useState("");

  React.useEffect(() => {
    if (!clusterId && clusterIds[0]) setClusterId(clusterIds[0]);
  }, [clusterIds, clusterId]);

  const jobsQuery = useQuery({
    queryKey: ["backup-jobs", clusterId],
    queryFn: () => apiFetch<Array<Record<string, unknown>>>(`/clusters/${clusterId}/backup-jobs`),
    enabled: Boolean(clusterId),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Backup jobs</CardTitle>
        <Select value={clusterId} onValueChange={setClusterId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Cluster" /></SelectTrigger>
          <SelectContent>
            {clusterIds.map((id) => (
              <SelectItem key={id} value={id}>
                {data?.resources.find((r) => r.clusterId === id)?.clusterName ?? id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead>Targets</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobsQuery.data?.map((job) => (
              <TableRow key={String(job.id)}>
                <TableCell className="font-medium">{String(job.id)}</TableCell>
                <TableCell>{String(job.schedule ?? "-")}</TableCell>
                <TableCell>{String(job.storage ?? "-")}</TableCell>
                <TableCell>{String(job.vmid ?? "all")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {jobsQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No backup jobs configured.</p>}
      </CardContent>
    </Card>
  );
}
