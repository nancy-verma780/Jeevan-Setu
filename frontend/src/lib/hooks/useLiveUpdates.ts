import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

const QUERIES = ["emergency", "emergencies", "staff-queue", "staff-hospital", "staff-case", "admin-overview", "admin-requests", "admin-hospitals", "admin-insights", "admin-notifications", "access-log", "broadcast", "comments", "handover"];

/**
 * Listens to the server's event stream and refreshes data as soon as anything
 * changes. Events carry no data; each screen refetches what it may see.
 * Polling stays on as a slower fallback (for example with the Python backend).
 */
export function useLiveUpdates(enabled: boolean): boolean {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const source = new EventSource("/api/stream");
    let timer: number | undefined;
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("change", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        for (const key of QUERIES) void client.invalidateQueries({ queryKey: [key] });
      }, 150);
    });
    return () => {
      window.clearTimeout(timer);
      source.close();
      setConnected(false);
    };
  }, [enabled, client]);
  return connected;
}

export const LiveContext = createContext(false);
export const useLive = () => useContext(LiveContext);
