const WIDTH = 280;
const HEIGHT = 48;

export function Sparkline({ values, color = "hsl(var(--primary))" }: { values: number[]; color?: string }) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return <div className="flex h-12 items-center text-xs text-muted-foreground">Not enough data yet</div>;
  }
  const max = Math.max(...clean, 1);
  const min = Math.min(...clean, 0);
  const range = max - min || 1;
  const points = clean
    .map((v, i) => {
      const x = (i / (clean.length - 1)) * WIDTH;
      const y = HEIGHT - ((v - min) / range) * HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-12 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
