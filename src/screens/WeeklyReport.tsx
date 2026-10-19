import config from "../data/config.json";
import report from "../data/weekly-report.json";
import CostBar from "../components/CostBar";
import PhoneFrame from "../components/PhoneFrame";
import { pct } from "../format";
import { href } from "../router";

const scale = Math.max(report.foodCostPct, report.lastWeekPct, report.targetPct) * 1.1;

export default function WeeklyReport() {
  const down = report.foodCostPct < report.lastWeekPct;
  return (
    <div className="grid gap-10 lg:grid-cols-2 items-start">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">What the owner receives</p>
        <PhoneFrame contactName={config.contact.name}>
          <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-bubble text-bubble-ink px-3.5 py-3 text-[15px] leading-snug space-y-3">
            <p className="font-semibold">{report.title}</p>
            <p>
              Food cost: <strong>{pct(report.foodCostPct)}</strong> (target {pct(report.targetPct)}).{" "}
              {down ? "Down" : "Up"} from {pct(report.lastWeekPct)} last week.
            </p>
            <div>
              <p className="font-semibold mb-1.5">{report.actionsIntro}</p>
              <ol className="list-decimal pl-5 space-y-2">
                {report.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ol>
            </div>
            <p>
              {report.closing} - {config.contact.name}
            </p>
          </div>
        </PhoneFrame>
      </div>

      <div className="space-y-6">
        <p className="text-muted text-lg">
          No spreadsheets, no logins. A short text every week with just what to do next, backed by the numbers.
        </p>
        <section className="rounded-xl border border-line bg-surface p-5 space-y-4">
          <h2 className="text-lg font-bold">The numbers behind the text</h2>
          <CostBar label="This week" value={report.foodCostPct} scale={scale} tone="bg-watch" />
          <CostBar label="Last week" value={report.lastWeekPct} scale={scale} tone="bg-bad" />
          <CostBar label="Target" value={report.targetPct} scale={scale} tone="bg-good" />
        </section>
        <a href={href("margins")} className="inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-bg">
          {report.fullNumbersLabel} →
        </a>
      </div>
    </div>
  );
}
