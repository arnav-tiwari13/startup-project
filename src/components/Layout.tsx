import type { ReactNode } from "react";
import config from "../data/config.json";
import restaurant from "../data/restaurant.json";
import { href, type Route } from "../router";

const NAV: { route: Route; title: string }[] = [
  { route: "overview", title: "Overview" },
  ...(config.screens as { route: Route; title: string }[]),
];

const linkClass = (active: boolean) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-accent text-bg" : "text-ink hover:bg-bg"}`;

export default function Layout({ route, title, children }: { route: Route; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-watch-bg text-watch text-center text-xs font-semibold tracking-wide uppercase py-1.5 px-4">
        {config.demoLabel}
      </div>

      <div className="flex flex-1">
        <aside className="hidden lg:flex lg:sticky lg:top-0 lg:self-start lg:h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
          <a href={href("home")} className="px-3 text-xl font-bold leading-tight">
            {config.productName}
          </a>
          <a href={href("home")} className="px-3 mt-1 text-xs text-accent font-medium">
            ← Back to website
          </a>
          <div className="px-3 mt-3 mb-6 text-sm text-muted">{restaurant.name}</div>
          <nav className="space-y-1">
            {NAV.map((n) => (
              <a key={n.route} href={href(n.route)} className={linkClass(n.route === route)}>
                {n.title}
              </a>
            ))}
          </nav>
          <p className="mt-auto px-3 text-xs text-muted">{config.contact.line}</p>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="lg:hidden border-b border-line bg-surface">
            <div className="px-4 pt-3 flex items-center justify-between gap-3">
              <a href={href("home")} className="font-bold text-lg leading-tight">
                {config.productName}
              </a>
              <span className="text-sm text-muted">{restaurant.name}</span>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 py-2">
              {NAV.map((n) => (
                <a key={n.route} href={href(n.route)} className={`${linkClass(n.route === route)} whitespace-nowrap`}>
                  {n.title}
                </a>
              ))}
            </nav>
          </header>

          <main className="flex-1 w-full max-w-6xl px-4 sm:px-8 lg:px-10 py-8">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
              <p className="text-sm text-muted mt-1">
                {restaurant.name} · {restaurant.location} · {restaurant.weekLabel}
              </p>
            </div>
            {children}
          </main>

          <footer className="border-t border-line py-4 px-4 sm:px-8 lg:px-10 text-xs text-muted">
            {config.demoLabel} · {restaurant.name} is a fictional restaurant
          </footer>
        </div>
      </div>
    </div>
  );
}
