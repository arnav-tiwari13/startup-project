import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Asked } from "./ref";

interface AiState {
  /** AI mode: widgets, rows, cells and chart points can be clicked to ask about them. */
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  asked: Asked | null;
  ask: (a: Asked) => void;
  clear: () => void;
}

const KEY = "platecfo.aiMode";
const read = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

const Ctx = createContext<AiState | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(read);
  const [asked, setAsked] = useState<Asked | null>(null);
  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    if (!on) setAsked(null);
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode: the toggle just won't be remembered */ }
  }, []);
  // Escape closes the panel.
  useEffect(() => {
    if (!asked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAsked(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asked]);
  const value = useMemo(() => ({ enabled, setEnabled, asked, ask: setAsked, clear: () => setAsked(null) }), [enabled, setEnabled, asked]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAi(): AiState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAi must be used inside AiProvider");
  return v;
}
