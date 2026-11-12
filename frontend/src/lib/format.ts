const pad = (n: number) => String(n).padStart(2, "0");

/** 125 -> "2:05" */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** 24-hour local time, "14:32" or "14:32:05". */
export function formatTime(iso: string, withSeconds = false): string {
  const d = new Date(iso);
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Local "2026-11-12 14:32" for dense admin tables. */
export function formatStamp(iso: string, withSeconds = false): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatTime(iso, withSeconds)}`;
}

/** "Today, 14:32" or "3 Nov, 09:15" in the given locale. */
export function formatDateTime(iso: string, locale: string, todayLabel: string, now = new Date()): string {
  const d = new Date(iso);
  if (isSameDay(d, now)) return `${todayLabel}, ${formatTime(iso)}`;
  const date = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }).format(d);
  return `${date}, ${formatTime(iso)}`;
}

export function formatKm(km: number): string {
  return km.toFixed(1);
}

export function formatScore(n: number): string {
  return n.toFixed(3);
}

/** +919811024521 -> +91 98••• ••521 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return `${phone.slice(0, 3)} ${phone.slice(3, 5)}••• ••${phone.slice(-3)}`;
}
