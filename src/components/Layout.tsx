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

const ICON_PATHS: Record<Route, string> = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
  advisor: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
  report: "M4 4h16v12H8l-4 4z",
  margins: "M3 5h18v14H3z M3 10h18 M9 5v14",
  audit: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  alerts: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0",
  invoice: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8",
};

function Icon({ route }: { route: Route }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON_PATHS[route]} />
    </svg>
  );
}

// Fade text that would otherwise be clipped mid-word while the sidebar is collapsed.
const revealOnOpen = "opacity-0 transition-opacity duration-300 group-hover/side:opacity-100 group-focus-within/side:opacity-100 motion-reduce:transition-none";

export default function Layout({ route, title, children }: { route: Route; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-watch-bg text-watch text-center text-xs font-semibold tracking-wide uppercase py-1.5 px-4">
        {config.demoLabel}
      </div>

      <div className="flex flex-1">
        {/* Reserves a slim strip. The sidebar inside widens over the page on hover or keyboard focus, so content never shifts. */}
        <div className="hidden lg:block relative w-14 shrink-0 z-30">
          <div className="sticky top-0 h-screen">
            <aside
              aria-label="Dashboard navigation"
              className="group/side absolute left-0 top-0 h-full w-14 overflow-hidden border-r border-line bg-surface transition-[width,box-shadow] duration-300 ease-out hover:w-64 hover:shadow-2xl focus-within:w-64 focus-within:shadow-2xl motion-reduce:transition-none"
            >
              <div className="flex h-full w-64 flex-col px-3 py-6">
                <a href={href("home")} className="flex items-center gap-3 text-xl font-bold leading-tight" aria-label={config.productName}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-bg">
                    {config.productName.charAt(0)}
                  </span>
                  <span className="whitespace-nowrap">{config.productName}</span>
                </a>
                <a href={href("home")} className={`mt-3 whitespace-nowrap text-xs font-medium text-accent ${revealOnOpen}`}>
                  ← Back to website
                </a>
                <div className={`mb-6 mt-1 whitespace-nowrap text-sm text-muted ${revealOnOpen}`}>{restaurant.name}</div>
                <nav className="mt-3 space-y-1">
                  {NAV.map((n) => {
                    const active = n.route === route;
                    return (
                      <a
                        key={n.route}
                        href={href(n.route)}
                        aria-label={n.title}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg text-sm font-medium ${
                          active
                            ? "text-ink group-hover/side:bg-accent group-hover/side:text-bg group-focus-within/side:bg-accent group-focus-within/side:text-bg"
                            : "text-ink hover:bg-bg"
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-accent text-bg" : ""}`}>
                          <Icon route={n.route} />
                        </span>
                        <span className="whitespace-nowrap">{n.title}</span>
                      </a>
                    );
                  })}
                </nav>
                <p className={`mt-6 text-xs text-muted ${revealOnOpen}`}>{config.contact.line}</p>
              </div>
            </aside>
          </div>
        </div>

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
