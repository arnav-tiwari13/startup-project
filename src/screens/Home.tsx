import audit from "../data/audit.json";
import config from "../data/config.json";
import report from "../data/weekly-report.json";
import restaurant from "../data/restaurant.json";
import { pct, usd } from "../format";
import { href, type Route } from "../router";

const monthlySavings = audit.leaks.reduce((sum, l) => sum + l.monthly, 0);
const overTarget = report.foodCostPct > report.targetPct;

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="text-sm font-semibold uppercase tracking-wide text-muted">{restaurant.weekLabel}</div>
        <div className="mt-3 flex items-end gap-6">
          <div>
            <div className="text-5xl font-bold tabular-nums leading-none">{pct(report.foodCostPct)}</div>
            <div className="mt-1 text-sm text-muted">food cost this week</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums leading-none text-muted">{pct(report.targetPct)}</div>
            <div className="mt-1 text-sm text-muted">target</div>
          </div>
        </div>
        <p className={`mt-4 rounded-lg px-3 py-2 font-semibold ${overTarget ? "bg-watch-bg text-watch" : "bg-good-bg text-good"}`}>
          About {usd(monthlySavings)} a month to win back by closing the gap.
        </p>
      </section>

      <ul className="space-y-2">
        {(config.screens as { route: Route; title: string; blurb: string }[]).map((s) => (
          <li key={s.route}>
            <a
              href={href(s.route)}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5"
            >
              <span className="flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block text-sm text-muted">{s.blurb}</span>
              </span>
              <span aria-hidden className="text-accent text-xl">
                →
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-muted">{config.contact.line}</p>
    </div>
  );
}
