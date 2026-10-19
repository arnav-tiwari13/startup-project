import { Fragment, useState } from "react";
import menu from "../data/menu.json";
import { pct, usd, usdCents } from "../format";

type Status = "Problem" | "Watch" | "Good";
type RecipeLine = { item: string; amount: string; cost: number };
type Dish = {
  id: string;
  name: string;
  price: number;
  costPerPlate: number;
  soldPerWeek: number;
  recipe: RecipeLine[];
  portionNote?: { recipeIndex: number; specOz: number; actualOz: number };
};

const dishes = menu.dishes as Dish[];

const foodCostPct = (d: Dish) => (d.costPerPlate / d.price) * 100;

const statusFor = (p: number): Status =>
  p > menu.thresholds.problemAbovePct ? "Problem" : p >= menu.thresholds.watchAbovePct ? "Watch" : "Good";

const STATUS_STYLE: Record<Status, string> = {
  Problem: "bg-bad-bg text-bad",
  Watch: "bg-watch-bg text-watch",
  Good: "bg-good-bg text-good",
};

function Badge({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function Breakdown({ dish }: { dish: Dish }) {
  const total = dish.recipe.reduce((sum, r) => sum + r.cost, 0);
  const note = dish.portionNote;
  const line = note ? dish.recipe[note.recipeIndex] : undefined;
  const actualCost = note && line ? (line.cost / note.specOz) * note.actualOz : 0;

  return (
    <div className="border-t border-line px-4 py-3 bg-bg/60">
      <table className="w-full max-w-xl text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-1 font-medium">Ingredient</th>
            <th className="py-1 font-medium">Amount</th>
            <th className="py-1 font-medium text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {dish.recipe.map((r) => (
            <tr key={r.item} className="border-t border-line">
              <td className="py-1.5 pr-2">{r.item}</td>
              <td className="py-1.5 pr-2 text-muted whitespace-nowrap">{r.amount}</td>
              <td className="py-1.5 text-right tabular-nums">{usd(r.cost)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-line font-bold">
            <td className="py-1.5" colSpan={2}>
              Cost per plate
            </td>
            <td className="py-1.5 text-right tabular-nums">{usd(total)}</td>
          </tr>
        </tbody>
      </table>
      {note && line && (
        <p className="mt-3 max-w-xl rounded-lg bg-bad-bg text-bad px-3 py-2 text-sm font-medium">
          The recipe says {note.specOz} oz of brisket. At the {note.actualOz} oz plates are averaging, the brisket costs{" "}
          {usd(actualCost)} instead of {usd(line.cost)}.
        </p>
      )}
    </div>
  );
}

export default function MenuMargins() {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...dishes].sort((a, b) => foodCostPct(b) - foodCostPct(a));
  const counts = (["Problem", "Watch", "Good"] as Status[]).map((st) => ({
    st,
    n: sorted.filter((d) => statusFor(foodCostPct(d)) === st).length,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted max-w-xl">
          Which dishes make money and which lose it, worst first, based on net sales. Click a dish to see what goes
          into it.
        </p>
        <div className="flex gap-2 text-sm">
          {counts.map(({ st, n }) => (
            <span key={st} className={`rounded-full px-3 py-1 font-semibold ${STATUS_STYLE[st]}`}>
              {n} {st}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[40rem]">
          <thead>
            <tr className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Dish</th>
              <th className="px-3 py-3 font-medium text-right">Price</th>
              <th className="px-3 py-3 font-medium text-right">Cost per plate</th>
              <th className="px-3 py-3 font-medium text-right">Food cost %</th>
              <th className="px-3 py-3 font-medium text-right">Sold/week</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const p = foodCostPct(d);
              const isOpen = open === d.id;
              return (
                <Fragment key={d.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : d.id)}
                    className="border-t border-line cursor-pointer hover:bg-bg/60"
                  >
                    <td className="px-4 py-3 font-semibold">
                      <button type="button" aria-expanded={isOpen} className="text-left">
                        {d.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{usdCents(d.price)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{usdCents(d.costPerPlate)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-base">{pct(p)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{d.soldPerWeek}</td>
                    <td className="px-4 py-3">
                      <Badge status={statusFor(p)} />
                    </td>
                    <td aria-hidden className="pr-3 text-muted text-lg">
                      {isOpen ? "−" : "+"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <Breakdown dish={d} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Problem: above {menu.thresholds.problemAbovePct}% · Watch: {menu.thresholds.watchAbovePct}-
        {menu.thresholds.problemAbovePct}% · Good: below {menu.thresholds.watchAbovePct}%
      </p>
    </div>
  );
}
