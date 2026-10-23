import { useState } from "react";
import ProfileForm from "../components/ProfileForm";
import { CONCEPTS, emptyForm, fromProfile } from "../profile";
import { useProfile } from "../profileStore";
import { useTheme, type Theme } from "../theme";
import { usd } from "../format";

const OPTIONS: { value: Theme; label: string; blurb: string }[] = [
  { value: "light", label: "Light", blurb: "Bright and clean for well-lit rooms." },
  { value: "dark", label: "Dark", blurb: "Easier on the eyes at night." },
];

function BusinessProfile() {
  const { profile, reload } = useProfile();
  const [editing, setEditing] = useState(false);
  const concept = CONCEPTS.find((c) => c.value === profile?.concept)?.label ?? "";
  return (
    <section className="max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Business profile</h2>
          <p className="mt-1 text-sm text-muted">What platecfo knows about your restaurant.</p>
        </div>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold hover:border-accent">
            {profile ? "Edit" : "Set up"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-5">
          <ProfileForm
            initial={profile ? fromProfile(profile) : emptyForm}
            stepped={false}
            submitLabel="Save changes"
            onSaved={() => {
              reload();
              setEditing(false);
            }}
          />
        </div>
      ) : profile ? (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted">Business</dt>
            <dd className="font-semibold">{profile.business_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Type</dt>
            <dd>{concept}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Location</dt>
            <dd>
              {profile.city}, {profile.state}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Annual revenue</dt>
            <dd>{usd(profile.annual_revenue_cents / 100)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Locations</dt>
            <dd>{profile.locations_count}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 text-sm text-muted">No profile saved yet.</p>
      )}
    </section>
  );
}

export default function Settings() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="space-y-6">
      <BusinessProfile />
      <section className="max-w-xl rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">Appearance</h2>
        <p className="mt-1 text-sm text-muted">Choose how platecfo looks. Your choice is saved on this device.</p>
        <div role="radiogroup" aria-label="Theme" className="mt-5 grid grid-cols-2 gap-3">
          {OPTIONS.map((o) => {
            const selected = theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setTheme(o.value)}
                className={`rounded-xl border-2 p-4 text-left transition ${selected ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
              >
                <span className="flex items-center justify-between font-semibold">
                  {o.label}
                  {selected && <span aria-hidden className="text-accent">✓</span>}
                </span>
                <span className="mt-1 block text-sm text-muted">{o.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
