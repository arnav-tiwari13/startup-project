export default function Stat({ label, value, sub, tone, hero }: { label: string; value: string; sub?: string; tone?: string; hero?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${
        hero ? "border-transparent bg-accent text-bg lg:col-span-2" : "border-line bg-surface"
      }`}
    >
      <div className={`text-xs font-semibold uppercase tracking-wider ${hero ? "opacity-80" : "text-muted"}`}>{label}</div>
      <div className={`mt-2 font-bold tabular-nums ${hero ? "text-5xl" : `text-3xl ${tone ?? ""}`}`}>{value}</div>
      {sub && <div className={`mt-1 text-sm ${hero ? "opacity-85" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}
