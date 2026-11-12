import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const KEY = "js_drill";

interface DrillState {
  drill: boolean;
  setDrill: (on: boolean) => void;
}

const DrillContext = createContext<DrillState>({ drill: false, setDrill: () => undefined });

/** Practice mode. While on, reports go to the preview endpoint, which stores nothing. */
export function DrillProvider({ children }: { children: ReactNode }) {
  const [drill, setDrillState] = useState(() => {
    try {
      return window.sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const setDrill = useCallback((on: boolean) => {
    setDrillState(on);
    try {
      window.sessionStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage blocked: mode lasts until reload */
    }
  }, []);
  const value = useMemo(() => ({ drill, setDrill }), [drill, setDrill]);
  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>;
}

export function useDrill(): DrillState {
  return useContext(DrillContext);
}
