import { useId, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import alertsData from "../data/price-alerts.json";
import audit from "../data/audit.json";
import config from "../data/config.json";
import m from "../data/marketing.json";
import menu from "../data/menu.json";
import report from "../data/weekly-report.json";
import restaurant from "../data/restaurant.json";
import PhoneFrame from "../components/PhoneFrame";
import { coreOffer, pct, priceLabel, usd, usdCents } from "../format";
import { href, type Route } from "../router";
import { scrollToId } from "../scroll";
import AuthModal from "../components/AuthModal";
import { signOut, useSession } from "../auth";
import { authConfigured } from "../supabase";

const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-accent px-5 py-3 font-semibold text-bg hover:opacity-90";
const btnSecondary = "inline-flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-3 font-semibold hover:border-accent";

const leakTotal = audit.leaks.reduce((s, l) => s + l.monthly, 0);
const gap = restaurant.foodCost.actualPct - restaurant.foodCost.theoreticalPct;
const priceAlerts = alertsData.alerts
  .map((a) => ({ ...a, change: ((a.thisWeek - a.lastWeek) / a.lastWeek) * 100 }))
  .filter((a) => a.change > alertsData.thresholdPct)
  .sort((a, b) => b.change - a.change);

function Anchor({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const go = (e: MouseEvent) => {
    e.preventDefault();
    scrollToId(id);
  };
  return (
    <a href={href("home")} onClick={go} className={className}>
      {children}
    </a>
  );
}

function Section({ id, tone, tight, children }: { id?: string; tone?: "alt"; tight?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-16 ${tight ? "py-10" : "py-12 sm:py-16"} ${tone === "alt" ? "bg-surface border-y border-line" : ""}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-8">{children}</div>
    </section>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="max-w-2xl mb-8">
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{title}</h2>
      {sub && <p className="mt-3 text-lg text-muted">{sub}</p>}
    </div>
  );
}

function TopNav() {
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 h-16 flex items-center gap-6">
        <a href={href("home")} className="text-xl font-bold">
          {config.productName}
        </a>
        <nav className="hidden md:flex gap-6 text-sm font-medium flex-1">
          {m.nav.map((n) => (
            <Anchor key={n.id} id={n.id} className="text-muted hover:text-ink">
              {n.label}
            </Anchor>
          ))}
        </nav>
        <div className="ml-auto md:ml-0 flex items-center gap-2">
          {authConfigured &&
            (session ? (
              <button type="button" onClick={() => signOut()} className="hidden sm:inline text-sm font-semibold px-3 py-2 hover:text-accent">
                Sign out{session.user.email ? ` (${session.user.email})` : ""}
              </button>
            ) : (
              <button type="button" onClick={() => setAuthOpen(true)} className="text-sm font-semibold px-3 py-2 hover:text-accent">
                Sign In
              </button>
            ))}
          <Anchor id="signup" className={`${btnPrimary} !py-2 text-sm`}>
            Get started
          </Anchor>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="md:hidden rounded-lg border border-line px-3 py-2 text-sm"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav className="md:hidden border-t border-line px-4 py-2 flex flex-col">
          {m.nav.map((n) => (
            <a
              key={n.id}
              href={href("home")}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                scrollToId(n.id);
              }}
              className="py-2.5 font-medium"
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}
      {authOpen && !session && <AuthModal onClose={() => setAuthOpen(false)} />}
    </header>
  );
}

const dishes = menu.dishes.map((d) => ({ ...d, p: (d.costPerPlate / d.price) * 100, revenue: d.price * d.soldPerWeek, weeklyCost: d.costPerPlate * d.soldPerWeek }));
const brisketAlert = alertsData.alerts.find((a) => a.item.startsWith("Brisket"))!;
const brisketChange = pct(((brisketAlert.thisWeek - brisketAlert.lastWeek) / brisketAlert.lastWeek) * 100);
const portionLeak = audit.leaks.find((l) => l.leak.includes("oz"))!;
const topDish = dishes
  .filter((d) => d.p < menu.thresholds.watchAbovePct && d.price >= 10)
  .sort((a, b) => b.revenue - a.revenue)[0];
const topRevenue = [...dishes].sort((a, b) => b.revenue - a.revenue)[0];
const topCost = [...dishes].sort((a, b) => b.weeklyCost - a.weeklyCost)[0];
const brisketPlate = menu.dishes.find((d) => d.id === "brisket-plate")!;

type Feature = Record<string, unknown>;
const feature = <T,>(id: string) => m.features.items.find((i) => i.id === id) as unknown as T;

function ChatCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-bg px-4 py-2.5 text-sm font-semibold">
        <span className="h-2 w-2 rounded-full bg-good" aria-hidden />
        {config.productName} AI
      </div>
      <div className="space-y-3 p-4 text-sm leading-snug">{children}</div>
      <div className="border-t border-line px-4 py-2.5 text-sm text-muted">Ask about your business…</div>
    </div>
  );
}

const Ask = ({ children }: { children: ReactNode }) => (
  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2.5 font-medium text-bg">{children}</div>
);
const Answer = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-bg px-3.5 py-3 space-y-2">{children}</div>
);

function HeroVisual() {
  const top = audit.leaks.slice(0, 3);
  return (
    <ChatCard>
      <Ask>{m.hero.chatQuestion}</Ask>
      <Answer>
        <p>
          Food cost is <strong>{pct(report.foodCostPct)}</strong> against your {pct(report.targetPct)} target, down from{" "}
          {pct(report.lastWeekPct)} last week. The biggest leaks:
        </p>
        <ul className="space-y-1">
          {top.map((l) => (
            <li key={l.rank} className="flex justify-between gap-3">
              <span>{l.leak}</span>
              <strong className="tabular-nums whitespace-nowrap">{usd(l.monthly)}/mo</strong>
            </li>
          ))}
        </ul>
        <p>
          Start with portions: holding brisket plates to the 8 oz spec is worth about{" "}
          <strong>{usd(portionLeak.monthly)}/month</strong>.
        </p>
      </Answer>
    </ChatCard>
  );
}

function Hero() {
  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 grid gap-12 lg:grid-cols-2 items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{m.hero.eyebrow}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight">{m.hero.headline}</h1>
          <p className="mt-5 text-lg text-muted max-w-xl">{m.hero.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Anchor id="signup" className={btnPrimary}>
              {m.hero.primaryCta}
            </Anchor>
            <a href={href("overview")} className={btnSecondary}>
              {m.hero.secondaryCta}
            </a>
          </div>
        </div>
        <HeroVisual />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-8 mt-12 grid gap-4 md:grid-cols-3">
        {m.benefits.map((b, i) => (
          <div key={b.title} className="rounded-xl border border-line bg-surface p-5">
            <div className="h-1 w-8 rounded-full bg-accent" />
            <h3 className="mt-3 text-lg font-bold">{b.title}</h3>
            <p className="mt-1 text-muted">{b.text}</p>
            {i === 0 && (
              <p className="mt-2 text-sm font-semibold text-good">
                Core is {usd(config.corePrice)}/month. The sample data shows about {usd(leakTotal)}/month in savings.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Audience() {
  return (
    <Section tone="alt">
      <SectionHead title={m.audience.title} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {m.audience.items.map((a) => (
          <div key={a.name} className="rounded-xl border border-line bg-bg p-5">
            <h3 className="text-lg font-bold">{a.name}</h3>
            <p className="mt-1 text-muted">{a.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Results() {
  const stats = [
    { value: `${gap.toFixed(1)} pts`, label: "Gap between actual and recipe food cost" },
    { value: usd(leakTotal), label: "Estimated savings per month" },
    { value: String(audit.leaks.length), label: "Leaks found in the sample week" },
    { value: String(priceAlerts.length), label: "Vendor price alerts this week" },
  ];
  return (
    <Section>
      <SectionHead title={m.results.title} sub={m.results.sub} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface p-5">
            <div className="text-4xl font-bold tabular-nums">{s.value}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-6">
        <a href={href("audit")} className="font-semibold text-accent">
          See the full savings estimate →
        </a>
      </p>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section id="how" tone="alt">
      <SectionHead title={m.how.title} />
      <ol className="grid gap-6 md:grid-cols-3">
        {m.how.steps.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-line bg-bg p-6">
            <div className="text-4xl font-bold text-accent/40 leading-none">{i + 1}</div>
            <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function AdvisorVisual() {
  const trends = priceAlerts.slice(0, 2).map((a) => `${a.item.replace(/ \(.*\)/, "")} +${pct(a.change)}`);
  return (
    <ChatCard>
      <Ask>What should I change this week, and what is trending?</Ask>
      <Answer>
        <p className="font-semibold">{report.actionsIntro}</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          {report.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
        <p>
          <strong>Trend:</strong> {trends.join(", ")} week over week. Expect menu costs to keep rising unless prices are adjusted.
        </p>
      </Answer>
    </ChatCard>
  );
}

function DashboardVisual() {
  const [sel, setSel] = useState(0);
  const lastDelta = report.lastWeekPct - report.foodCostPct;
  const tiles = [
    {
      label: "Food cost",
      value: pct(report.foodCostPct),
      sub: `Target ${pct(report.targetPct)}`,
      question: "Why is food cost above target?",
      answer: `It is down ${lastDelta.toFixed(1)} points from ${pct(report.lastWeekPct)} last week but still ${(report.foodCostPct - report.targetPct).toFixed(1)} points over target. Main drivers: brisket is up ${brisketChange} at ${brisketAlert.vendor} while the plate price has not moved, and plates average ${brisketPlate.portionNote?.actualOz} oz against the ${brisketPlate.portionNote?.specOz} oz spec.`,
    },
    {
      label: "Top revenue item",
      value: usd(topRevenue.revenue),
      sub: `${topRevenue.name.replace(/ \(.*\)/, "")} / week`,
      question: `Why is the ${topRevenue.name.replace(/ \(.*\)/, "").toLowerCase()} my top earner?`,
      answer: `It sells ${topRevenue.soldPerWeek} a week at ${usd(topRevenue.price)}. It also runs at ${pct(topRevenue.p)} food cost, so it is the best place to hold portions or raise the price.`,
    },
    {
      label: "Biggest cost",
      value: usd(topCost.weeklyCost),
      sub: `${topCost.name.replace(/ \(.*\)/, "")} ingredients / week`,
      question: "Why is this my biggest expense?",
      answer: `${topCost.soldPerWeek} sold a week at ${usd(topCost.costPerPlate)} per plate adds up. Brisket is up ${brisketChange} at ${brisketAlert.vendor}, and plates are running over the ${brisketPlate.portionNote?.specOz} oz spec.`,
    },
    {
      label: "Price alerts",
      value: String(priceAlerts.length),
      sub: "items up over 5%",
      question: "Which prices went up?",
      answer: priceAlerts.map((a) => `${a.item.replace(/ \(.*\)/, "")} (+${pct(a.change)})`).join(", ") + ".",
    },
  ];
  const t = tiles[sel];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((x, i) => (
          <button
            key={x.label}
            type="button"
            aria-pressed={sel === i}
            onClick={() => setSel(i)}
            className={`rounded-xl border p-3 text-left ${sel === i ? "border-accent bg-bg" : "border-line hover:border-accent"}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">{x.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{x.value}</div>
            <div className="text-xs text-muted">{x.sub}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <Ask>{t.question}</Ask>
        <Answer>
          <p>{t.answer}</p>
        </Answer>
      </div>
      <p className="mt-3 text-xs text-muted">Click a metric to ask why.</p>
    </div>
  );
}

function InventoryVisual() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="font-semibold">1 × {brisketPlate.name.replace(/ \(.*\)/, "")} sold</div>
        <div className="font-bold tabular-nums">{usdCents(brisketPlate.price)}</div>
      </div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Inventory used</div>
      <ul className="mt-2 divide-y divide-line text-sm">
        {brisketPlate.recipe.slice(0, 5).map((r) => (
          <li key={r.item} className="flex justify-between gap-3 py-1.5">
            <span>{r.item.replace(/ \(.*\)/, "")}</span>
            <span className="tabular-nums text-bad font-semibold">−{r.amount}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-good-bg text-good px-3 py-2 text-sm font-semibold">
        Stock updated. Cost per plate {usdCents(brisketPlate.costPerPlate)}.
      </p>
    </div>
  );
}

function SuppliersVisual() {
  const f = feature<{ order: { number: string; vendor: string; status: string; eta: string; miles: number; progress: number }; suggestion: string }>("suppliers");
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            {f.order.number} · {f.order.vendor}
          </span>
          <span className="rounded-full bg-good-bg text-good px-2.5 py-0.5 text-xs font-bold uppercase">{f.order.status}</span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-line overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${f.order.progress}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm text-muted">
          <span>{f.order.miles} miles away</span>
          <span>
            Arrives <strong className="text-ink">{f.order.eta}</strong>
          </span>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-watch-bg text-watch p-4 text-sm font-medium shadow-lg">
        <span className="font-bold">AI suggestion: </span>
        {f.suggestion.replace("{brisketChange}", brisketChange)}
      </div>
    </div>
  );
}

function MarketingVisual() {
  const f = feature<{ audience: string; steps: string[] }>("marketing");
  const fill = (t: string) => t.replace("{topDish}", topDish.name.replace(/ \(.*\)/, "").toLowerCase()).replace("{topDishPct}", pct(topDish.p));
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">Target audience</div>
      <div className="mt-1 inline-block rounded-full bg-accent px-3 py-1 text-sm font-semibold text-bg">{f.audience}</div>
      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Steps</div>
      <ol className="mt-2 space-y-3">
        {f.steps.map((st, i) => (
          <li key={st} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg border border-line text-xs font-bold">{i + 1}</span>
            <span>{fill(st)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TeamVisual() {
  const roles = feature<{ roles: { id: string; label: string; heading: string; items: string[] }[] }>("team").roles;
  const [active, setActive] = useState(roles[0].id);
  const r = roles.find((x) => x.id === active)!;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
        {roles.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={active === x.id}
            onClick={() => setActive(x.id)}
            className={`rounded-lg py-2 text-sm font-semibold ${active === x.id ? "bg-accent text-bg" : "text-muted hover:text-ink"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-3 pt-4">
        <div className="font-bold">{r.heading}</div>
        <ul className="mt-3 space-y-2 text-sm">
          {r.items.map((it) => (
            <li key={it} className="flex gap-2">
              <span className="text-good font-bold">✓</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MobileVisual() {
  return (
    <PhoneFrame contactName={config.productName}>
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-bubble text-bubble-ink px-3.5 py-3 text-sm leading-snug space-y-2">
        <p className="font-semibold">{report.title}</p>
        <p>
          Food cost: <strong>{pct(report.foodCostPct)}</strong> (target {pct(report.targetPct)}). Down from{" "}
          {pct(report.lastWeekPct)} last week.
        </p>
        <p className="font-semibold">{report.actionsIntro}</p>
        <ol className="list-decimal pl-5 space-y-1.5">
          {report.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ol>
        <p>{report.closing}</p>
      </div>
    </PhoneFrame>
  );
}

const VISUALS: Record<string, () => React.ReactElement> = {
  advisor: AdvisorVisual,
  dashboard: DashboardVisual,
  inventory: InventoryVisual,
  suppliers: SuppliersVisual,
  marketing: MarketingVisual,
  team: TeamVisual,
  mobile: MobileVisual,
};

function Features() {
  return (
    <Section id="features">
      <SectionHead title={m.features.title} />
      <div className="space-y-14 sm:space-y-16">
        {m.features.items.map((f, i) => {
          const Visual = VISUALS[f.id];
          const link = f as unknown as { route?: Route; cta?: string };
          return (
            <div key={f.id} className="grid gap-10 lg:grid-cols-2 items-center">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="text-sm font-semibold uppercase tracking-wide text-accent">{f.eyebrow}</p>
                <h3 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">{f.title}</h3>
                <p className="mt-3 text-lg text-muted">{f.text}</p>
                <ul className="mt-5 space-y-2">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-good font-bold">✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {link.route && link.cta && (
                  <a href={href(link.route)} className="mt-6 inline-block font-semibold text-accent">
                    {link.cta} →
                  </a>
                )}
              </div>
              <div className={`max-w-md w-full mx-auto ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                <Visual />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Security() {
  return (
    <Section id="security" tone="alt">
      <SectionHead title={m.security.title} sub={m.security.sub} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {m.security.items.map((it) => (
          <div key={it.title} className="rounded-xl border border-line bg-bg p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-good-bg text-good font-bold" aria-hidden>
              ✓
            </div>
            <h3 className="mt-3 text-lg font-bold">{it.title}</h3>
            <p className="mt-1 text-muted">{it.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Works() {
  return (
    <Section tight>
      <SectionHead title={m.works.title} sub={m.works.text} />
      <ul className="flex flex-wrap gap-3">
        {m.works.chips.map((c) => (
          <li key={c} className="rounded-full border border-line bg-surface px-4 py-2 font-medium">
            {c}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Pricing() {
  const { core, later } = m.pricing;
  return (
    <Section id="pricing" tone="alt">
      <SectionHead title={m.pricing.title} sub={m.pricing.sub} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border-2 border-accent bg-bg p-7">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-wide text-accent">{core.name}</span>
            <span className="rounded-full bg-watch-bg text-watch px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">{m.pricing.badge}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums">{usd(config.corePrice)}</span>
            <span className="text-muted">/month</span>
          </div>
          <p className="mt-2 text-muted">{core.tagline}</p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {core.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-good font-bold">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Anchor id="signup" className={`${btnPrimary} mt-7`}>
            {core.cta}
          </Anchor>
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-dashed border-line bg-bg p-7">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">{later.name}</div>
          <p className="mt-2 text-muted">{later.tagline}</p>
          <ul className="mt-5 space-y-2">
            {later.features.map((f) => (
              <li key={f} className="text-muted">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="px-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left font-semibold"
      >
        {q}
        <span
          aria-hidden
          className={`text-accent text-xl transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-4 text-muted">{a.replace("{price}", priceLabel)}</p>
        </div>
      </div>
    </div>
  );
}

function Faq() {
  return (
    <Section id="faq">
      <SectionHead title={m.faq.title} />
      <div className="max-w-3xl divide-y divide-line rounded-xl border border-line bg-surface">
        {m.faq.items.map((f) => (
          <FaqItem key={f.q} q={f.q} a={f.a} />
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };
  const input = "w-full rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-accent";
  return (
    <Section id="signup" tone="alt">
      <div className="grid gap-10 lg:grid-cols-2 items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{m.cta.title}</h2>
          <p className="mt-3 text-lg text-muted">{m.cta.text}</p>
          <p className="mt-6 font-semibold">{coreOffer}</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-line bg-bg p-6 space-y-4">
          {sent ? (
            <div role="status" className="rounded-lg bg-watch-bg text-watch px-4 py-4 font-medium">
              Thanks for trying the demo. Nothing was sent, because this site has no backend yet.
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium">
                Your name
                <input required className={`${input} mt-1`} autoComplete="name" />
              </label>
              <label className="block text-sm font-medium">
                Restaurant
                <input required className={`${input} mt-1`} />
              </label>
              <label className="block text-sm font-medium">
                Phone or email
                <input required className={`${input} mt-1`} autoComplete="email" />
              </label>
              <button type="submit" className={`${btnPrimary} w-full`}>
                {m.cta.button}
              </button>
              <p className="text-xs text-muted">{m.cta.demoNote}</p>
            </>
          )}
        </form>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="py-10 text-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xs">
          <div className="text-lg font-bold">{config.productName}</div>
          <p className="mt-1 text-muted">{m.footer.blurb}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-medium">
          {m.footer.links.map((l) => (
            <Anchor key={l.id} id={l.id} className="text-muted hover:text-ink">
              {l.label}
            </Anchor>
          ))}
          <a href={href("overview")} className="text-muted hover:text-ink">
            Live demo
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 sm:px-8 mt-8 text-xs text-muted">
        {config.demoLabel} · {restaurant.name} is a fictional restaurant
      </p>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen">
      <div className="bg-watch-bg text-watch text-center text-xs font-semibold tracking-wide uppercase py-1.5 px-4">
        {config.demoLabel}
      </div>
      <TopNav />
      <main>
        <Hero />
        <Audience />
        <Results />
        <HowItWorks />
        <Features />
        <Security />
        <Works />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
