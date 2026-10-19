import audit from "../data/audit.json";
import config from "../data/config.json";
import report from "../data/weekly-report.json";
import Stat from "../components/Stat";
import { pct, usd } from "../format";
import { href, type Route } from "../router";

const monthlySavings = audit.leaks.reduce((sum, l) => sum + l.monthly, 0);
const gap = report.foodCostPct - report.targetPct;
const change = report.foodCostPct - report.lastWeekPct;
const maxLeak = Math.max(...audit.leaks.map((l) => l.monthly));

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Food cost this week"
          value={pct(report.foodCostPct)}
          sub={`${change < 0 ? "Down" : "Up"} ${Math.abs(change).toFixed(1)} pts from ${pct(report.lastWeekPct)}`}
        />
        <Stat label="Target" value={pct(report.targetPct)} sub="Where recipes say you should be" />
        <Stat label="Gap to target" value={`${gap.toFixed(1)} pts`} tone="text-watch" sub="Still above target" />
        <Stat label="Est. monthly savings" value={usd(monthlySavings)} tone="text-good" sub="If the top 5 leaks are closed" />
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-xl border border-line bg-surface p-5">
          <h2 className="text-lg font-bold mb-4">Where the money is going</h2>
          <ol className="space-y-4">
            {audit.leaks.map((l) => (
              <li key={l.rank}>
                <div className="flex gap-3 items-baseline">
                  <span className="font-bold text-accent w-4">{l.rank}</span>
                  <span className="flex-1 leading-snug">{l.leak}</span>
                  <span className="font-bold tabular-nums">{usd(l.monthly)}</span>
                </div>
                <div className="mt-1.5 ml-7 h-1.5 rounded-full bg-line overflow-hidden">
                  <div className="h-full bg-bad" style={{ width: `${(l.monthly / maxLeak) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-lg font-bold mb-4">Explore the demo</h2>
          <ul className="space-y-2">
            {(config.screens as { route: Route; title: string; blurb: string }[]).map((s) => (
              <li key={s.route}>
                <a href={href(s.route)} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent">
                  <span className="flex-1">
                    <span className="block font-semibold">{s.title}</span>
                    <span className="block text-sm text-muted">{s.blurb}</span>
                  </span>
                  <span aria-hidden className="text-accent text-xl">→</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-sm text-muted lg:hidden">{config.contact.line}</p>
    </div>
  );
}
