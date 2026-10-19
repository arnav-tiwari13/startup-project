import type { ReactNode } from "react";
import config from "../data/config.json";
import restaurant from "../data/restaurant.json";
import { href, type Route } from "../router";

export default function Layout({ route, title, children }: { route: Route; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-watch-bg text-watch text-center text-xs font-semibold tracking-wide uppercase py-1.5 px-4">
        {config.demoLabel}
      </div>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <a href={href("home")} className="font-bold text-lg leading-tight">
            {config.productName}
          </a>
          <span className="text-sm text-muted text-right">{restaurant.name}</span>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6">
        {route !== "home" && (
          <a href={href("home")} className="inline-block text-sm text-accent font-medium mb-3">
            ← Overview
          </a>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold mb-5">{title}</h1>
        {children}
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-muted">
        {config.demoLabel} · {restaurant.name} is a fictional restaurant
      </footer>
    </div>
  );
}
