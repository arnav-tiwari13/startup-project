import { useState, type ReactNode } from "react";
import { CHALLENGES, CONCEPTS, POS_SYSTEMS, ROLES, STEP_FIELDS, validate, type Errors, type ProfileForm as Form } from "../profile";
import { saveProfile } from "../profileStore";

const STEPS = [
  { title: "Your restaurant", blurb: "The basics, so the numbers we show are about your business." },
  { title: "How you operate", blurb: "Size and setup. Skip anything you don't know yet." },
  { title: "Your numbers", blurb: "Rough figures are fine. They set your baseline and your targets." },
];

const input = "w-full rounded-lg border border-line bg-bg px-3 py-2.5 outline-none focus:border-accent aria-[invalid=true]:border-bad";

function Field({ label, hint, error, optional, children, htmlFor }: { label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 flex items-baseline justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

// onboarding: three steps, one at a time. Otherwise (editing): every section on one page.
export default function ProfileForm({ initial, stepped, submitLabel, onSaved }: { initial: Form; stepped: boolean; submitLabel: string; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };
  const field = (key: keyof Form) => ({
    id: key,
    value: form[key] as string,
    onChange: set(key),
    "aria-invalid": Boolean(errors[key]),
    className: input,
  });
  const toggleChallenge = (value: string) =>
    setForm((f) => ({ ...f, challenges: f.challenges.includes(value) ? f.challenges.filter((c) => c !== value) : [...f.challenges, value] }));

  const sections: ReactNode[] = [
    <div key="0" className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Business name" htmlFor="businessName" error={errors.businessName}>
          <input {...field("businessName")} autoComplete="organization" placeholder="Cedar Lane Smokehouse" />
        </Field>
      </div>
      <Field label="Type of restaurant" htmlFor="concept" error={errors.concept}>
        <select {...field("concept")}>
          <option value="">Choose one</option>
          {CONCEPTS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cuisine" htmlFor="cuisine" error={errors.cuisine} hint="For example BBQ, Mexican, pizza, burgers.">
        <input {...field("cuisine")} placeholder="BBQ" />
      </Field>
      <Field label="City" htmlFor="city" error={errors.city}>
        <input {...field("city")} autoComplete="address-level2" placeholder="Austin" />
      </Field>
      <Field label="State or region" htmlFor="state" error={errors.state}>
        <input {...field("state")} autoComplete="address-level1" placeholder="TX" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Your role" htmlFor="ownerRole" error={errors.ownerRole}>
          <select {...field("ownerRole")}>
            <option value="">Choose one</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>,

    <div key="1" className="grid gap-4 sm:grid-cols-2">
      <Field label="Number of locations" htmlFor="locations" error={errors.locations}>
        <input {...field("locations")} inputMode="numeric" />
      </Field>
      <Field label="Year opened" htmlFor="openedYear" error={errors.openedYear} optional>
        <input {...field("openedYear")} inputMode="numeric" placeholder="2019" />
      </Field>
      <Field label="Seats" htmlFor="seats" error={errors.seats} optional hint="Leave blank for a truck or ghost kitchen.">
        <input {...field("seats")} inputMode="numeric" />
      </Field>
      <Field label="Days open per week" htmlFor="daysOpen" error={errors.daysOpen} optional>
        <input {...field("daysOpen")} inputMode="numeric" placeholder="7" />
      </Field>
      <Field label="Staff on payroll" htmlFor="staff" error={errors.staff} optional>
        <input {...field("staff")} inputMode="numeric" />
      </Field>
      <Field label="POS system" htmlFor="pos" error={errors.pos} optional>
        <input {...field("pos")} list="pos-systems" placeholder="Toast" />
        <datalist id="pos-systems">
          {POS_SYSTEMS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Main food vendors" htmlFor="vendors" error={errors.vendors} optional hint="Separate with commas.">
          <input {...field("vendors")} placeholder="Sysco, US Foods, Local produce" />
        </Field>
      </div>
    </div>,

    <div key="2" className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Annual revenue (USD)" htmlFor="annualRevenue" error={errors.annualRevenue} hint="Total yearly sales across all locations. Your best estimate is fine.">
          <input {...field("annualRevenue")} inputMode="decimal" placeholder="1,200,000" />
        </Field>
      </div>
      <Field label="Average check (USD)" htmlFor="avgCheck" error={errors.avgCheck} optional>
        <input {...field("avgCheck")} inputMode="decimal" placeholder="18.50" />
      </Field>
      <Field label="Customers served per week" htmlFor="weeklyCovers" error={errors.weeklyCovers} optional>
        <input {...field("weeklyCovers")} inputMode="numeric" />
      </Field>
      <Field label="Monthly food purchases (USD)" htmlFor="monthlyFoodPurchases" error={errors.monthlyFoodPurchases} optional>
        <input {...field("monthlyFoodPurchases")} inputMode="decimal" placeholder="31,000" />
      </Field>
      <Field label="Current food cost %" htmlFor="foodCostPct" error={errors.foodCostPct} optional hint="Food spend as a share of food sales.">
        <input {...field("foodCostPct")} inputMode="decimal" placeholder="35.8" />
      </Field>
      <Field label="Target food cost %" htmlFor="targetFoodCostPct" error={errors.targetFoodCostPct} optional>
        <input {...field("targetFoodCostPct")} inputMode="decimal" placeholder="33" />
      </Field>
      <Field label="Labor cost %" htmlFor="laborCostPct" error={errors.laborCostPct} optional>
        <input {...field("laborCostPct")} inputMode="decimal" placeholder="30" />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-semibold">
          Biggest challenges <span className="text-xs font-normal text-muted">Optional, pick any</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {CHALLENGES.map((c) => {
            const on = form.challenges.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleChallenge(c.value)}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${on ? "border-accent bg-accent/10 text-accent" : "border-line bg-bg hover:border-accent/60"}`}
              >
                {on && <span aria-hidden>✓ </span>}
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>,
  ];

  const submit = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const bad = STEP_FIELDS.findIndex((fields) => fields.some((f) => found[f]));
      if (stepped) setStep(bad);
      return;
    }
    setBusy(true);
    setSaveError(null);
    try {
      await saveProfile(form);
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  const next = () => {
    const found = validate(form, STEP_FIELDS[step]);
    setErrors((e) => ({ ...e, ...found }));
    if (Object.keys(found).length === 0) setStep(step + 1);
  };

  const last = step === STEPS.length - 1;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!stepped || last) void submit();
        else next();
      }}
    >
      {stepped ? (
        <>
          <ol className="mb-6 flex gap-2" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li key={s.title} aria-current={i === step ? "step" : undefined} className="flex-1">
                <div className={`h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
                <div className={`mt-1.5 text-xs font-semibold ${i === step ? "text-ink" : "text-muted"}`}>{s.title}</div>
              </li>
            ))}
          </ol>
          <h2 className="text-xl font-bold">{STEPS[step].title}</h2>
          <p className="mb-5 mt-1 text-sm text-muted">{STEPS[step].blurb}</p>
          {sections[step]}
        </>
      ) : (
        <div className="space-y-8">
          {STEPS.map((s, i) => (
            <section key={s.title}>
              <h3 className="mb-4 text-base font-bold">{s.title}</h3>
              {sections[i]}
            </section>
          ))}
        </div>
      )}

      {saveError && (
        <p role="alert" className="mt-5 rounded-lg bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
          {saveError}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        {stepped && step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-line px-4 py-2.5 font-semibold hover:border-accent">
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="submit" disabled={busy} className="rounded-lg bg-accent px-6 py-2.5 font-semibold text-bg hover:opacity-90 disabled:opacity-60">
          {busy ? "Saving…" : stepped && !last ? "Continue" : submitLabel}
        </button>
      </div>
    </form>
  );
}
