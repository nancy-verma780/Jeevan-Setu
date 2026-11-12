import { useEffect, useState } from "react";

/**
 * Counts down from a server-provided number of seconds. Using the server's
 * figure avoids errors from a wrong phone clock.
 */
export function useCountdown(secondsLeft: number | null | undefined, syncKey: unknown): number {
  const [endsAt, setEndsAt] = useState(() => Date.now() + (secondsLeft ?? 0) * 1000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setEndsAt(Date.now() + (secondsLeft ?? 0) * 1000);
  }, [secondsLeft, syncKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return Math.max(0, Math.round((endsAt - now) / 1000));
}

/** Ticks once a second; for tables that show many countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
