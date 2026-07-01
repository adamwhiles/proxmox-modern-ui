import * as React from "react";
import { Link } from "react-router-dom";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import type { ClusterResource } from "@proxmox-ui/shared";
import { useDashboardResources } from "@/hooks/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { GuestActionsMenu } from "@/features/guests/GuestActionsMenu";
import { CreateQemuWizard } from "@/features/guests/CreateQemuWizard";
import { CreateLxcWizard } from "@/features/guests/CreateLxcWizard";
import { ClusterOverview } from "@/features/dashboard/ClusterOverview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBytes, formatPercent, formatUptime } from "@/lib/utils";

export function DashboardPage() {
  const { data, isLoading, error } = useDashboardResources();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [selectedClusterId, setSelectedClusterId] = React.useState<string>("");
  const [selectedNode, setSelectedNode] = React.useState<string>("");

  const resources = data?.resources ?? [];
  const nodes = resources.filter((r) => r.type === "node");
  const guests = resources.filter((r) => r.type === "qemu" || r.type === "lxc");

  React.useEffect(() => {
    const first = nodes[0];
    if (!selectedClusterId && first) {
      setSelectedClusterId(first.clusterId);
      setSelectedNode(first.node ?? "");
    }
  }, [nodes, selectedClusterId]);

  const availableNodes = nodes.filter((n) => n.clusterId === selectedClusterId);

  const summary = {
    nodes: nodes.length,
    running: guests.filter((g) => g.status === "running").length,
    stopped: guests.filter((g) => g.status !== "running").length,
  };

  const columns = React.useMemo<ColumnDef<ClusterResource>[]>(
    () => [
      {
        header: "Name",
        accessorFn: (r) => r.name ?? `${r.type}/${r.vmid}`,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Link
              to={`/guests/${r.clusterId}/${r.node}/${r.type}/${r.vmid}`}
              className="font-medium hover:underline"
            >
              {r.name ?? `${r.type}-${r.vmid}`}
            </Link>
          );
        },
      },
      { header: "Type", accessorKey: "type" },
      { header: "Cluster", accessorKey: "clusterName" },
      { header: "Node", accessorKey: "node" },
      { header: "ID", accessorKey: "vmid" },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      { header: "CPU", accessorFn: (r) => formatPercent(r.cpu) },
      { header: "Memory", accessorFn: (r) => formatBytes(r.mem) },
      { header: "Uptime", accessorFn: (r) => formatUptime(r.uptime) },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.node || r.vmid === undefined) return null;
          return (
            <GuestActionsMenu
              clusterId={r.clusterId}
              node={r.node}
              type={r.type as "qemu" | "lxc"}
              vmid={r.vmid}
              status={r.status}
            />
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: guests,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <ClusterOverview resources={resources} />

      {data?.errors && Object.keys(data.errors).length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {Object.entries(data.errors).map(([clusterId, msg]) => (
            <p key={clusterId}>Cluster {clusterId}: {msg}</p>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Guests</CardTitle>
            <p className="text-xs text-muted-foreground">{summary.running} running · {summary.stopped} stopped</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedClusterId} onValueChange={(v) => { setSelectedClusterId(v); setSelectedNode(""); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Cluster" /></SelectTrigger>
              <SelectContent>
                {[...new Set(nodes.map((n) => n.clusterId))].map((id) => (
                  <SelectItem key={id} value={id}>{nodes.find((n) => n.clusterId === id)?.clusterName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedNode} onValueChange={setSelectedNode}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Node" /></SelectTrigger>
              <SelectContent>
                {availableNodes.map((n) => (
                  <SelectItem key={n.node} value={n.node ?? ""}>{n.node}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClusterId && selectedNode && (
              <>
                <CreateQemuWizard clusterId={selectedClusterId} node={selectedNode} />
                <CreateLxcWizard clusterId={selectedClusterId} node={selectedNode} />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading resources…</p>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to load dashboard data.</p>
          ) : guests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No VMs or containers found. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
