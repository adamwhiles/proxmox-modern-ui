import { useQuery } from "@tanstack/react-query";
import type { AuditLogEntry } from "@proxmox-ui/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiError } from "@/lib/api";

export function AuditPage() {
  const query = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiFetch<AuditLogEntry[]>("/audit"),
  });

  if (query.error instanceof ApiError && query.error.status === 403) {
    return <p className="text-sm text-muted-foreground">Only app-admins can view the audit log.</p>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Audit log</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(entry.timestamp).toLocaleString()}</TableCell>
                <TableCell>{entry.proxmoxUser}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>{entry.target ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={entry.result === "success" ? "success" : "destructive"}>{entry.result}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {query.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No audit entries yet.</p>}
      </CardContent>
    </Card>
  );
}
