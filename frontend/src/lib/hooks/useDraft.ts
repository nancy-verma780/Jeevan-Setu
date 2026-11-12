import { useCallback, useEffect, useRef, useState } from "react";

/** Keeps a form draft in this browser so a refresh or back press loses nothing. */
export function useDraft<T>(storageKey: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? ({ ...initial(), ...JSON.parse(raw) } as T) : initial();
    } catch {
      return initial();
    }
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(value));
        setSavedAt(new Date());
      } catch {
        setSavedAt(null);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [storageKey, value]);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* storage blocked: nothing to clear */
    }
  }, [storageKey]);

  return { value, setValue, savedAt, clear };
}
