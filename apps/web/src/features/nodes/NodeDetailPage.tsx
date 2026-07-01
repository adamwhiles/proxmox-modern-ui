import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UsageBar } from "@/components/UsageBar";
import { Sparkline } from "@/components/Sparkline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNodeStatus, useNodeRrdData } from "@/hooks/useDashboard";
import { formatBytes, formatUptime } from "@/lib/utils";

export function NodeDetailPage() {
  const { clusterId, node } = useParams<{ clusterId: string; node: string }>();
  const [timeframe, setTimeframe] = React.useState<"hour" | "day" | "week">("hour");
  const statusQuery = useNodeStatus(clusterId!, node!);
  const rrdQuery = useNodeRrdData(clusterId!, node!, timeframe);

  if (!clusterId || !node) return null;

  const status = statusQuery.data;
  const cpuInfo = status?.cpuinfo as { cpus?: number } | undefined;
  const memory = status?.memory as { used?: number; total?: number } | undefined;
  const loadavg = status?.loadavg as string[] | undefined;

  const points = rrdQuery.data ?? [];
  const cpuSeries = points.map((p) => Number(p.cpu ?? 0) * 100);
  const memSeries = points.map((p) => Number(p.memused ?? 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{node}</h1>
          <p className="text-sm text-muted-foreground">{clusterId}</p>
        </div>
        <Badge variant={status?.status === "online" || status ? "success" : "destructive"}>
          {(status?.status as string) ?? (statusQuery.isLoading ? "loading…" : "unknown")}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">CPU cores</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{cpuInfo?.cpus ?? "-"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Memory</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{formatBytes(memory?.used)} / {formatBytes(memory?.total)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Uptime</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{formatUptime(status?.uptime as number | undefined)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Load average</CardTitle></CardHeader>
          <CardContent className="text-lg font-semibold">{loadavg ? loadavg.join(" / ") : "-"}</CardContent>
        </Card>
      </div>

      {memory?.used !== undefined && memory?.total && (
        <Card>
          <CardContent className="pt-6">
            <UsageBar label="Memory usage" fraction={memory.used / memory.total} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">History</CardTitle>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Last hour</SelectItem>
              <SelectItem value="day">Last day</SelectItem>
              <SelectItem value="week">Last week</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">CPU usage</p>
            <Sparkline values={cpuSeries} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Memory used</p>
            <Sparkline values={memSeries} color="hsl(280 70% 55%)" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
