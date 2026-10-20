import config from "../data/config.json";
import { signInWithGoogle } from "../auth";
import { authConfigured } from "../supabase";
import { href } from "../router";

export default function SignInGate() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="text-2xl font-bold">{config.productName}</h1>
        <p className="mt-2 text-sm text-muted">Sign in to view your dashboard.</p>
        <button
          type="button"
          disabled={!authConfigured}
          onClick={() => signInWithGoogle()}
          className="mt-6 w-full rounded-lg bg-accent px-5 py-3 font-semibold text-bg hover:opacity-90 disabled:opacity-50"
        >
          Sign in with Google
        </button>
        {!authConfigured && <p className="mt-3 text-xs text-muted">Sign-in isn't configured yet.</p>}
        <a href={href("home")} className="mt-6 inline-block text-sm font-medium text-accent">
          ← Back to website
        </a>
      </div>
    </div>
  );
}
