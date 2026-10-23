import config from "../data/config.json";
import ProfileForm from "../components/ProfileForm";
import SignOutButton from "../components/SignOutButton";
import { emptyForm } from "../profile";

// Shown once, right after a user signs in without a business profile.
export default function Onboarding({ onSaved }: { onSaved: () => void }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-5 sm:px-8">
        <span className="flex items-center gap-3 text-xl font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-bg">{config.productName.charAt(0)}</span>
          {config.productName}
        </span>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Set up your restaurant</h1>
        <p className="mb-6 mt-2 text-muted">A few questions so platecfo can work from your real numbers. It takes about two minutes, and you can edit it later in Settings.</p>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">
          <ProfileForm initial={emptyForm} stepped submitLabel="Finish setup" onSaved={onSaved} />
        </div>
      </main>
    </div>
  );
}
