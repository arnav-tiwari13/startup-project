import { useState } from "react";
import { cleanTitle, MAX_TITLE_CHARS, type ConversationSummary } from "./history";

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-line hover:text-ink focus-visible:opacity-100";

// One sidebar entry: open it, rename it inline, or delete it after a confirm.
export default function ConversationRow({
  c,
  active,
  onOpen,
  onRename,
  onDelete,
}: {
  c: ConversationSummary;
  active: boolean;
  onOpen: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [draft, setDraft] = useState(c.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode("view");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const clean = cleanTitle(draft);
    if (!clean) return setError(`Enter a name up to ${MAX_TITLE_CHARS} characters.`);
    if (clean === c.title) return setMode("view");
    void run(() => onRename(clean));
  };

  if (mode === "rename") {
    return (
      <div className="px-1 py-1">
        <input
          autoFocus
          aria-label="Conversation name"
          value={draft}
          maxLength={MAX_TITLE_CHARS}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setMode("view");
              setError(null);
            }
          }}
          onBlur={() => !busy && !error && setMode("view")}
          className="w-full rounded-lg border border-accent bg-bg px-2.5 py-1.5 text-sm outline-none"
        />
        {error && <p role="alert" className="px-1 pt-1 text-xs text-bad">{error}</p>}
      </div>
    );
  }

  if (mode === "confirm") {
    return (
      <div className="rounded-lg bg-bad-bg px-2.5 py-2 text-sm">
        <p className="truncate font-medium text-bad">Delete this chat?</p>
        {error && <p role="alert" className="pt-1 text-xs text-bad">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void run(onDelete)} className="rounded-md bg-bad px-2.5 py-1 text-xs font-semibold text-bg disabled:opacity-60">
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button type="button" disabled={busy} onClick={() => { setMode("view"); setError(null); }} className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative rounded-lg transition ${active ? "bg-accent/10" : "hover:bg-bg"}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? "true" : undefined}
        title={c.title}
        className={`block w-full truncate rounded-lg py-2 pl-2.5 pr-16 text-left text-sm ${active ? "font-semibold text-accent" : ""}`}
      >
        {c.title}
      </button>
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-100 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <button type="button" aria-label={`Rename ${c.title}`} onClick={() => { setDraft(c.title); setError(null); setMode("rename"); }} className={iconBtn}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        <button type="button" aria-label={`Delete ${c.title}`} onClick={() => { setError(null); setMode("confirm"); }} className={iconBtn}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 6h18 M8 6V4h8v2 M19 6l-1 14H6L5 6 M10 11v6 M14 11v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
