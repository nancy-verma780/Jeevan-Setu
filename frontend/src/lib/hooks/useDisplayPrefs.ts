import { useEffect, useState } from "react";

/** Accessibility modes, saved on this device only. */
export interface DisplayPrefs {
  highContrast: boolean;
  largeText: boolean;
  simple: boolean;
}
const KEY = "jeevansetu:display";
const DEFAULT: DisplayPrefs = { highContrast: false, largeText: false, simple: false };

export function readDisplayPrefs(): DisplayPrefs {
  try {
    return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<DisplayPrefs>) };
  } catch {
    return DEFAULT;
  }
}

export function applyDisplayPrefs(p: DisplayPrefs) {
  const root = document.documentElement;
  root.classList.toggle("hc", p.highContrast);
  root.classList.toggle("large-text", p.largeText || p.simple);
}

export function useDisplayPrefs(): [DisplayPrefs, (patch: Partial<DisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<DisplayPrefs>(readDisplayPrefs);
  useEffect(() => {
    applyDisplayPrefs(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* private mode: keep for this visit only */
    }
  }, [prefs]);
  return [prefs, (patch) => setPrefs((p) => ({ ...p, ...patch }))];
}
