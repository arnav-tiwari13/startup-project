import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import config from "../data/config.json";
import { sendPasswordReset, setNewPassword, signInWithEmail, signInWithGoogle, signUpWithEmail } from "../auth";

type Mode = "signin" | "signup" | "forgot" | "newpassword";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create an account",
  forgot: "Reset your password",
  newpassword: "Choose a new password",
};

const inputClass = "w-full rounded-lg border border-line bg-bg px-4 py-3 text-ink focus:border-accent focus:outline-none";

export default function AuthModal({ onClose, initialMode = "signin" }: { onClose: () => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (mode !== "forgot" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await signInWithEmail(email, password);
        if (error) setError(error.message);
      } else if (mode === "signup") {
        const { data, error } = await signUpWithEmail(email, password);
        if (error) setError(error.message);
        else if (!data.session) setNotice("Check your email for a link to confirm your account.");
      } else if (mode === "forgot") {
        const { error } = await sendPasswordReset(email);
        if (error) setError(error.message);
        else setNotice("If that email has an account, a reset link is on its way.");
      } else {
        const { error } = await setNewPassword(password);
        if (error) setError(error.message);
        else onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const showEmail = mode !== "newpassword";
  const showPassword = mode !== "forgot";
  const submitLabel = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", newpassword: "Save password" }[mode];

  return createPortal(
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
          {TITLES[mode]}
        </h2>

        {(mode === "signin" || mode === "signup") && (
          <>
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="mt-6 w-full rounded-lg border border-line bg-surface px-5 py-3 font-semibold hover:border-accent"
            >
              Continue with Google
            </button>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={submit} className={`space-y-3 ${mode === "signin" || mode === "signup" ? "" : "mt-6"}`}>
          {showEmail && (
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          )}
          {showPassword && (
            <input
              type="password"
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder={mode === "newpassword" ? "New password" : "Password"}
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          )}
          {mode === "signin" && (
            <div className="text-right">
              <button type="button" onClick={() => switchTo("forgot")} className="text-sm font-medium text-accent hover:underline">
                Forgot password?
              </button>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          {notice && <p role="status" className="text-sm text-muted">{notice}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-accent px-5 py-3 font-semibold text-bg hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : submitLabel}
          </button>
        </form>

        {mode !== "newpassword" && (
          <p className="mt-6 text-center text-sm text-muted">
            {mode === "signin" && (
              <>
                New to {config.productName}?{" "}
                <button type="button" onClick={() => switchTo("signup")} className="font-semibold text-accent hover:underline">
                  Create an account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchTo("signin")} className="font-semibold text-accent hover:underline">
                  Sign in
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button type="button" onClick={() => switchTo("signin")} className="font-semibold text-accent hover:underline">
                Back to sign in
              </button>
            )}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
