import audit from "../data/audit.json";
import config from "../data/config.json";
import restaurant from "../data/restaurant.json";
import { pct, usd } from "../format";

const { actualPct, theoreticalPct } = restaurant.foodCost;
const gap = actualPct - theoreticalPct;
const savingsLow = (audit.savingsRange.lowPct / 100) * restaurant.monthlySales;
const savingsHigh = (audit.savingsRange.highPct / 100) * restaurant.monthlySales;
const leakTotal = audit.leaks.reduce((sum, l) => sum + l.monthly, 0);
const maxLeak = Math.max(...audit.leaks.map((l) => l.monthly));
const barScale = Math.max(actualPct, theoreticalPct) * 1.1;

function CostBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-2xl font-bold tabular-nums">{pct(value)}</span>
      </div>
      <div className="h-4 rounded-full bg-line overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(value / barScale) * 100}%` }} />
      </div>
    </div>
  );
}

export default function AuditResult() {
  return (
    <div className="space-y-6">
      <p className="text-muted">What you get after the free one-week audit.</p>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-xl font-bold leading-snug mb-5">{audit.headline}</h2>
        <div className="space-y-4">
          <CostBar label="What you actually spent" value={actualPct} tone="bg-bad" />
          <CostBar label="What your recipes say you should spend" value={theoreticalPct} tone="bg-good" />
        </div>
        <p className="mt-4 text-sm text-muted">
          Gap: <strong className="text-ink">{gap.toFixed(1)} points</strong> on about {usd(restaurant.monthlySales)} in
          monthly sales.
        </p>
      </section>

      <section className="rounded-xl bg-good-bg text-good p-5">
        <div className="text-sm font-semibold uppercase tracking-wide">Estimated savings</div>
        <div className="text-3xl font-bold tabular-nums my-1">
          {usd(savingsLow)}-{usd(savingsHigh)} <span className="block text-lg font-semibold">per month</span>
        </div>
        <div className="text-sm">
          {audit.savingsRange.lowPct}-{audit.savingsRange.highPct} points on {usd(restaurant.monthlySales)} a month.
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Your top 5 leaks</h2>
        <ol className="space-y-2">
          {audit.leaks.map((l) => (
            <li key={l.rank} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex gap-3">
                <span className="font-bold text-accent w-5 shrink-0">{l.rank}</span>
                <span className="flex-1 leading-snug">{l.leak}</span>
                <span className="font-bold tabular-nums whitespace-nowrap">{usd(l.monthly)}</span>
              </div>
              <div className="mt-2 ml-8 h-1.5 rounded-full bg-line overflow-hidden">
                <div className="h-full bg-bad" style={{ width: `${(l.monthly / maxLeak) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
        <div className="flex justify-between px-4 pt-3 font-bold">
          <span>Total per month</span>
          <span className="tabular-nums">{usd(leakTotal)}</span>
        </div>
      </section>

      <div className="rounded-xl border-2 border-accent bg-surface p-5 text-center">
        <p className="text-xl font-bold">{config.coreOffer}</p>
      </div>
    </div>
  );
}
