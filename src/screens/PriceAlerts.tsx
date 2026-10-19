import data from "../data/price-alerts.json";
import { pct, usdCents } from "../format";
import { href } from "../router";

const alerts = data.alerts
  .map((a) => ({ ...a, change: ((a.thisWeek - a.lastWeek) / a.lastWeek) * 100 }))
  .filter((a) => a.change > data.thresholdPct)
  .sort((a, b) => b.change - a.change);

export default function PriceAlerts() {
  return (
    <div>
      <p className="text-muted mb-5">
        Items that cost more than {data.thresholdPct}% above last week. You find out the week it happens, not months
        later.
      </p>

      <ul className="space-y-4">
        {alerts.map((a) => (
          <li key={a.item} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold leading-snug">{a.item}</div>
                <div className="text-sm text-muted">{a.vendor}</div>
              </div>
              <span className="rounded-full bg-bad-bg text-bad px-2.5 py-0.5 text-sm font-bold tabular-nums whitespace-nowrap">
                +{pct(a.change)}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2 tabular-nums">
              <span className="text-muted line-through">{usdCents(a.lastWeek)}</span>
              <span aria-hidden className="text-muted">
                →
              </span>
              <span className="text-2xl font-bold">{usdCents(a.thisWeek)}</span>
            </div>

            <div className="mt-3 text-sm">
              <span className="text-muted">Affects: </span>
              {a.affects.join(", ")}
            </div>

            <p className="mt-3 rounded-lg bg-watch-bg text-watch px-3 py-2 text-sm font-medium">
              <span className="font-bold">What to do: </span>
              {a.action}
            </p>
          </li>
        ))}
      </ul>

      <div className="text-center mt-6">
        <a href={href("margins")} className="text-accent font-semibold">
          See how this hits your menu margins →
        </a>
      </div>
    </div>
  );
}
