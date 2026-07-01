import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">unknown</Badge>;
  const variant = status === "running" ? "success" : status === "stopped" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
