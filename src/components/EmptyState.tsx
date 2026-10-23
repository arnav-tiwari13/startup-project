import { href } from "../router";

// Shown on screens that have nothing to display yet. A new account starts with no data.
export default function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="max-w-xl rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18 M7 15l4-4 3 3 5-6" />
        </svg>
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <a href={href("overview")} className="mt-5 inline-block text-sm font-semibold text-accent">
        Back to Overview
      </a>
    </section>
  );
}
