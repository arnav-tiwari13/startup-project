import { useEffect, useState } from "react";
import config from "../data/config.json";
import { signInWithGoogle } from "../auth";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const signingIn = mode === "signin";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted hover:text-ink"
        >
          ✕
        </button>
        <h2 id="auth-title" className="text-2xl font-bold text-center">
          {signingIn ? "Sign in" : "Create an account"}
        </h2>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="mt-6 w-full rounded-lg border border-line bg-surface px-5 py-3 font-semibold hover:border-accent"
        >
          Continue with Google
        </button>
        <p className="mt-6 text-center text-sm text-muted">
          {signingIn ? `New to ${config.productName}? ` : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(signingIn ? "signup" : "signin")}
            className="font-semibold text-accent hover:underline"
          >
            {signingIn ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
