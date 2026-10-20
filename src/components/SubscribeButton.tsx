import { useState } from "react";
import { startCheckout } from "../checkout";

export default function SubscribeButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await startCheckout(); // navigates away to Stripe on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg disabled:opacity-60"
      >
        {busy ? "Opening checkout…" : "Subscribe · $99/mo"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-muted">
          {error}
        </p>
      )}
    </div>
  );
}
