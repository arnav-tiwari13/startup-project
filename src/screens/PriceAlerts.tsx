import data from "../data/price-alerts.json";
import { pct, usdCents } from "../format";
import { href } from "../router";

const alerts = data.alerts
  .map((a) => ({ ...a, change: ((a.thisWeek - a.lastWeek) / a.lastWeek) * 100 }))
  .filter((a) => a.change > data.thresholdPct)
  .sort((a, b) => b.change - a.change);

export default function PriceAlerts() {
  return (
    <div className="space-y-5">
      <p className="text-muted max-w-2xl">
        Items that cost more than {data.thresholdPct}% above last week. You find out the week it happens, not months
        later.
      </p>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[56rem]">
          <thead>
            <tr className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-3 py-3 font-medium">Vendor</th>
              <th className="px-3 py-3 font-medium text-right">Last week</th>
              <th className="px-3 py-3 font-medium text-right">This week</th>
              <th className="px-3 py-3 font-medium text-right">Change</th>
              <th className="px-3 py-3 font-medium">Affects</th>
              <th className="px-4 py-3 font-medium">What to do</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.item} className="border-t border-line align-top">
                <td className="px-4 py-3 font-semibold">{a.item}</td>
                <td className="px-3 py-3 text-muted">{a.vendor}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted">{usdCents(a.lastWeek)}</td>
                <td className="px-3 py-3 text-right tabular-nums font-bold">{usdCents(a.thisWeek)}</td>
                <td className="px-3 py-3 text-right">
                  <span className="rounded-full bg-bad-bg text-bad px-2.5 py-0.5 font-bold tabular-nums whitespace-nowrap">
                    +{pct(a.change)}
                  </span>
                </td>
                <td className="px-3 py-3">{a.affects.join(", ")}</td>
                <td className="px-4 py-3">
                  <span className="block rounded-lg bg-watch-bg text-watch px-2.5 py-1.5 font-medium">{a.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <a href={href("margins")} className="inline-block text-accent font-semibold">
        See how this hits your menu margins →
      </a>
    </div>
  );
}
