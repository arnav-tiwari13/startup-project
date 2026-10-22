import { useTheme, type Theme } from "../theme";

const OPTIONS: { value: Theme; label: string; blurb: string }[] = [
  { value: "light", label: "Light", blurb: "Bright and clean for well-lit rooms." },
  { value: "dark", label: "Dark", blurb: "Easier on the eyes at night." },
];

export default function Settings() {
  const [theme, setTheme] = useTheme();
  return (
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
  );
}
