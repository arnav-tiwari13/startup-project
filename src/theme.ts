import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "platecfo-theme";
const systemTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

const stored = (): Theme | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
};

const apply = (theme: Theme) => document.documentElement.setAttribute("data-theme", theme);

// Call once before the first render so a saved choice never flashes the wrong theme.
export const initTheme = () => {
  const saved = stored();
  if (saved) apply(saved);
};

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && (e.newValue === "light" || e.newValue === "dark")) {
        apply(e.newValue);
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const choose = (next: Theme) => {
    apply(next);
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode: the choice still applies for this visit.
    }
  };
  return [theme, choose];
}
