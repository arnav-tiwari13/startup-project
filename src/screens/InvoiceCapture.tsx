import invoice from "../data/invoice.json";
import alerts from "../data/price-alerts.json";
import restaurant from "../data/restaurant.json";
import { pct, usd, usdCents } from "../format";

type Line = {
  item: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  flag: string | null;
  alertItem?: string;
  orderedQuantity?: number;
  unitLabel?: string;
};

const lines = invoice.lines as Line[];
const lineTotal = (l: Line) => l.quantity * l.unitPrice;
const invoiceTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);

function flagMessage(l: Line): string | null {
  if (l.flag === "short" && l.orderedQuantity !== undefined) {
    const credit = (l.orderedQuantity - l.quantity) * l.unitPrice;
    return `Ordered ${l.orderedQuantity} ${l.unitLabel}, received ${l.quantity}. Credit requested: ${usdCents(credit)}.`;
  }
  if (l.flag === "price-increase") {
    const a = alerts.alerts.find((x) => x.item === l.alertItem);
    if (a) {
      const change = ((a.thisWeek - a.lastWeek) / a.lastWeek) * 100;
      return `Price increase: up ${pct(change)} vs last week (${usdCents(a.lastWeek)} to ${usdCents(a.thisWeek)}).`;
    }
  }
  return null;
}

function MockInvoice() {
  return (
    <div
      className="w-full max-w-lg rounded-sm bg-white text-neutral-800 shadow-lg ring-1 ring-black/10 p-4 font-mono text-xs leading-tight -rotate-1"
      aria-label="Photo of a sample invoice"
    >
      <div className="flex justify-between border-b border-neutral-400 pb-2 mb-2">
        <div>
          <div className="text-sm font-bold">{invoice.vendor}</div>
          <div>Invoice {invoice.invoiceNumber}</div>
        </div>
        <div className="text-right">
          <div>{invoice.date}</div>
          <div>Delivery copy</div>
        </div>
      </div>
      <div className="mb-2">
        Bill to: {invoice.billTo}, {invoice.billToLocation}
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-400 text-left">
            <th className="py-1 font-semibold">Item</th>
            <th className="py-1 font-semibold">Qty</th>
            <th className="py-1 font-semibold text-right">Price</th>
            <th className="py-1 font-semibold text-right">Ext</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.item}>
              <td className="py-1 pr-1">{l.item}</td>
              <td className="py-1 pr-1 whitespace-nowrap">
                {l.quantity} {l.unit}
              </td>
              <td className="py-1 pr-1 text-right">{l.unitPrice.toFixed(2)}</td>
              <td className="py-1 text-right">{lineTotal(l).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 border-t border-neutral-400 pt-1 text-right font-bold">
        Total {invoiceTotal.toFixed(2)}
      </div>
    </div>
  );
}

export default function InvoiceCapture() {
  return (
    <div className="space-y-6">
      <ol className="grid gap-2 sm:grid-cols-3">
        {invoice.steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-bg text-sm font-bold">
              {i + 1}
            </span>
            <span className="text-sm font-medium leading-snug">{s}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-2 items-start">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">What you send</h2>
        <MockInvoice />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          What we pull out of it ({restaurant.name})
        </h2>
        <div className="rounded-xl border border-line bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Qty</th>
                <th className="px-2 py-2 font-medium text-right">Unit</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const message = flagMessage(l);
                const tone = l.flag === "short" ? "bg-bad-bg text-bad" : "bg-watch-bg text-watch";
                return (
                  <tr key={l.item} className="border-t border-line align-top">
                    <td className="px-3 py-2.5" colSpan={message ? 4 : 1}>
                      {message ? (
                        <div>
                          <div className="flex justify-between gap-2">
                            <span className="font-semibold">{l.item}</span>
                            <span className="tabular-nums whitespace-nowrap">
                              {l.quantity} {l.unit} × {usdCents(l.unitPrice)} = <strong>{usdCents(lineTotal(l))}</strong>
                            </span>
                          </div>
                          <p className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${tone}`}>{message}</p>
                        </div>
                      ) : (
                        l.item
                      )}
                    </td>
                    {!message && (
                      <>
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          {l.quantity} {l.unit}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{usdCents(l.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{usdCents(lineTotal(l))}</td>
                      </>
                    )}
                  </tr>
                );
              })}
              <tr className="border-t-2 border-line font-bold">
                <td className="px-3 py-2.5" colSpan={3}>
                  Invoice total
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{usd(invoiceTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-xl bg-good-bg text-good px-4 py-3 text-center font-bold">✓ {invoice.readBadge}: {lines.length} lines, {lines.filter((l) => l.flag).length} flagged</div>
      </section>
      </div>
    </div>
  );
}
