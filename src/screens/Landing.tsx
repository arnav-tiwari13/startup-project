import { useId, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import alertsData from "../data/price-alerts.json";
import audit from "../data/audit.json";
import config from "../data/config.json";
import invoice from "../data/invoice.json";
import m from "../data/marketing.json";
import menu from "../data/menu.json";
import report from "../data/weekly-report.json";
import restaurant from "../data/restaurant.json";
import PhoneFrame from "../components/PhoneFrame";
import { coreOffer, pct, priceLabel, usd, usdCents } from "../format";
import { href, type Route } from "../router";
import { scrollToId } from "../scroll";
import { signInWithGoogle, signOut, useSession } from "../auth";
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
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
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
          <a href={href("overview")} className="hidden sm:inline text-sm font-semibold px-3 py-2 hover:text-accent">
            Live demo
          </a>
          {authConfigured &&
            (session ? (
              <button type="button" onClick={() => signOut()} className="hidden sm:inline text-sm font-semibold px-3 py-2 hover:text-accent">
                Sign out{session.user.email ? ` (${session.user.email})` : ""}
              </button>
            ) : (
              <button type="button" onClick={() => signInWithGoogle()} className="text-sm font-semibold px-3 py-2 hover:text-accent">
                Sign in with Google
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
          <a href={href("overview")} className="py-2.5 font-medium">
            Live demo
          </a>
        </nav>
      )}
    </header>
  );
}

function HeroVisual() {
  const top = audit.leaks.slice(0, 3);
  const max = Math.max(...top.map((l) => l.monthly));
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-xl">
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="font-semibold uppercase tracking-wide">{restaurant.name}</span>
        <span>{restaurant.weekLabel}</span>
      </div>
      <div className="mt-4 flex items-end gap-6">
        <div>
          <div className="text-5xl font-bold tabular-nums leading-none">{pct(report.foodCostPct)}</div>
          <div className="mt-1 text-sm text-muted">food cost this week</div>
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums leading-none text-muted">{pct(report.targetPct)}</div>
          <div className="mt-1 text-sm text-muted">target</div>
        </div>
      </div>
      <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Biggest leaks, per month</div>
      <ul className="mt-2 space-y-3">
        {top.map((l) => (
          <li key={l.rank}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="leading-snug">{l.leak}</span>
              <span className="font-bold tabular-nums">{usd(l.monthly)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden">
              <div className="h-full bg-bad" style={{ width: `${(l.monthly / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
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
            {i === 2 && (
              <p className="mt-2 text-sm font-semibold text-good">
                Core is {usd(config.corePrice)}/month. The sample report finds about {usd(leakTotal)}/month.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
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
    <Section tone="alt">
      <SectionHead title={m.results.title} sub={m.results.sub} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-bg p-5">
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
    <Section id="how">
      <SectionHead title={m.how.title} />
      <ol className="grid gap-6 md:grid-cols-3">
        {m.how.steps.map((s, i) => (
          <li key={s.title} className="relative rounded-xl border border-line bg-surface p-6">
            <div className="text-4xl font-bold text-accent/40 leading-none">{i + 1}</div>
            <h3 className="mt-2 text-xl font-bold">{s.title}</h3>
            <p className="mt-2 text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ReportVisual() {
  return (
    <PhoneFrame contactName={config.contact.name}>
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
      </div>
    </PhoneFrame>
  );
}

const statusTone = (p: number) =>
  p > menu.thresholds.problemAbovePct ? "bg-bad-bg text-bad" : p >= menu.thresholds.watchAbovePct ? "bg-watch-bg text-watch" : "bg-good-bg text-good";
const statusLabel = (p: number) =>
  p > menu.thresholds.problemAbovePct ? "Problem" : p >= menu.thresholds.watchAbovePct ? "Watch" : "Good";

function MarginsVisual() {
  const rows = [...menu.dishes]
    .map((d) => ({ ...d, p: (d.costPerPlate / d.price) * 100 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 4);
  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 font-medium">Dish</th>
            <th className="px-3 py-2.5 font-medium text-right">Food cost</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-line">
              <td className="px-4 py-2.5 font-medium">{d.name}</td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums">{pct(d.p)}</td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusTone(d.p)}`}>{statusLabel(d.p)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertsVisual() {
  return (
    <div className="space-y-3">
      {priceAlerts.slice(0, 3).map((a) => (
        <div key={a.item} className="rounded-xl border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold leading-snug">{a.item}</div>
              <div className="text-sm text-muted">{a.vendor}</div>
            </div>
            <span className="rounded-full bg-bad-bg text-bad px-2.5 py-0.5 text-sm font-bold tabular-nums">+{pct(a.change)}</span>
          </div>
          <div className="mt-2 text-sm tabular-nums">
            <span className="text-muted line-through">{usdCents(a.lastWeek)}</span> → <strong>{usdCents(a.thisWeek)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function InvoiceVisual() {
  const flagged = invoice.lines.filter((l) => l.flag);
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">Invoice {invoice.invoiceNumber}</span>
        <span className="text-muted">{invoice.date}</span>
      </div>
      {flagged.map((l) => (
        <div
          key={l.item}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${l.flag === "short" ? "bg-bad-bg text-bad" : "bg-watch-bg text-watch"}`}
        >
          <div className="font-semibold">{l.item}</div>
          {l.flag === "short" && l.orderedQuantity !== undefined
            ? `Ordered ${l.orderedQuantity}, received ${l.quantity}. Credit: ${usdCents((l.orderedQuantity - l.quantity) * l.unitPrice)}`
            : "Price increase flagged"}
        </div>
      ))}
      <div className="rounded-lg bg-good-bg text-good px-3 py-2 text-center text-sm font-bold">✓ {invoice.verifiedBadge}</div>
    </div>
  );
}

const VISUALS: Record<string, () => React.ReactElement> = {
  report: ReportVisual,
  margins: MarginsVisual,
  alerts: AlertsVisual,
  invoice: InvoiceVisual,
};

function Features() {
  return (
    <Section id="features" tone="alt">
      <SectionHead title={m.features.title} />
      <div className="space-y-14 sm:space-y-16">
        {m.features.items.map((f, i) => {
          const Visual = VISUALS[f.id];
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
                <a href={href(f.route as Route)} className="mt-6 inline-block font-semibold text-accent">
                  {f.cta} →
                </a>
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
        <Results />
        <HowItWorks />
        <Features />
        <Works />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
