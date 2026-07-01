import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/Sparkline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGuestRrdData, type GuestType } from "@/hooks/useGuests";
import { formatBytes, formatPercent } from "@/lib/utils";

export function GuestStats({ clusterId, node, type, vmid }: { clusterId: string; node: string; type: GuestType; vmid: number }) {
  const [timeframe, setTimeframe] = React.useState<"hour" | "day" | "week">("hour");
  const { data, isLoading } = useGuestRrdData(clusterId, node, type, vmid, timeframe);

  const points = data ?? [];
  const last = points.at(-1);
  const cpuSeries = points.map((p) => (p.cpu ?? 0) * 100);
  const memSeries = points.map((p) => p.mem ?? 0);
  const netInSeries = points.map((p) => p.netin ?? 0);
  const netOutSeries = points.map((p) => p.netout ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={timeframe} onValueChange={(v) => setTimeframe(v as typeof timeframe)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hour">Last hour</SelectItem>
            <SelectItem value="day">Last day</SelectItem>
            <SelectItem value="week">Last week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading stats…</p>
      ) : points.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stats reported yet for this guest.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">CPU usage — {formatPercent((last?.cpu ?? 0))}</CardTitle>
            </CardHeader>
            <CardContent><Sparkline values={cpuSeries} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Memory — {formatBytes(last?.mem)} / {formatBytes(last?.maxmem)}
              </CardTitle>
            </CardHeader>
            <CardContent><Sparkline values={memSeries} color="hsl(280 70% 55%)" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Network in — {formatBytes(last?.netin)}/s</CardTitle>
            </CardHeader>
            <CardContent><Sparkline values={netInSeries} color="hsl(150 60% 40%)" /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Network out — {formatBytes(last?.netout)}/s</CardTitle>
            </CardHeader>
            <CardContent><Sparkline values={netOutSeries} color="hsl(30 80% 50%)" /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
