import config from "../data/config.json";
import report from "../data/weekly-report.json";
import PhoneFrame from "../components/PhoneFrame";
import { pct } from "../format";
import { href } from "../router";

export default function WeeklyReport() {
  const down = report.foodCostPct < report.lastWeekPct;
  return (
    <div>
      <p className="text-muted mb-6">
        This is what lands on your phone every week. No spreadsheets, no logins. Just what to do next.
      </p>

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

      <div className="text-center mt-6">
        <a
          href={href("margins")}
          className="inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-bg"
        >
          {report.fullNumbersLabel} →
        </a>
      </div>
    </div>
  );
}
