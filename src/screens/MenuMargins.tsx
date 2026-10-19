import { useState } from "react";
import menu from "../data/menu.json";
import { pct, usd } from "../format";

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
      <table className="w-full text-sm">
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
        <p className="mt-3 rounded-lg bg-bad-bg text-bad px-3 py-2 text-sm font-medium">
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

  return (
    <div>
      <p className="text-muted mb-2">
        Which dishes make money and which lose it, worst first. Based on net sales. Tap a dish to see what goes
        into it.
      </p>
      <p className="text-xs text-muted mb-5">
        Problem: above {menu.thresholds.problemAbovePct}% · Watch: {menu.thresholds.watchAbovePct}-
        {menu.thresholds.problemAbovePct}% · Good: below {menu.thresholds.watchAbovePct}%
      </p>

      <ul className="space-y-3">
        {sorted.map((d) => {
          const p = foodCostPct(d);
          const isOpen = open === d.id;
          return (
            <li key={d.id} className="rounded-xl border border-line bg-surface overflow-hidden">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : d.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-snug">{d.name}</div>
                  <div className="text-sm text-muted mt-0.5">
                    {usd(d.price)} price · {usd(d.costPerPlate)} cost · {d.soldPerWeek} sold/week
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold tabular-nums leading-none mb-1.5">{pct(p)}</div>
                  <Badge status={statusFor(p)} />
                </div>
                <span aria-hidden className="text-muted text-lg">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen && <Breakdown dish={d} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
