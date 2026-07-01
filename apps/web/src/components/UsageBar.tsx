import { cn } from "@/lib/utils";

export function UsageBar({ fraction, label }: { fraction: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const color = pct > 90 ? "bg-destructive" : pct > 75 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between text-xs text-muted-foreground"><span>{label}</span><span>{pct.toFixed(0)}%</span></div>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
