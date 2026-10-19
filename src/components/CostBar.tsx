export default function CostBar({ label, value, scale, tone }: { label: string; value: number; scale: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{value.toFixed(1)}%</span>
      </div>
      <div className="h-4 rounded-full bg-line overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(value / scale) * 100}%` }} />
      </div>
    </div>
  );
}
