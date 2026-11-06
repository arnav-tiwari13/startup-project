import { useAi } from "./AiContext";

/** Header switch for AI mode. A real switch role, so it works with keyboard and screen readers. */
export default function AiToggle() {
  const { enabled, setEnabled } = useAi();
  return (
    <button
      type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${enabled ? "border-accent bg-accent text-bg" : "border-line bg-surface text-ink hover:border-accent hover:text-accent"}`}
    >
      <span aria-hidden>✦</span> AI mode
      <span className="text-xs font-medium opacity-90">{enabled ? "On" : "Off"}</span>
    </button>
  );
}
