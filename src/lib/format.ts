// Shared formatting helpers (centralized so pages stop re-implementing them).

/** Thousands-separated integer, or "-" for null/undefined. */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '-';
  return num.toLocaleString();
}

/** Compact number for tight UI (1.2k, 3.4M). Falls back to full for small values. */
export function formatCompact(num: number | null | undefined): string {
  if (num === null || num === undefined || Number.isNaN(num)) return '-';
  if (Math.abs(num) < 1000) return num.toLocaleString();
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}

/** Human duration from a number of minutes (catalogue times are in minutes). */
export function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return '-';
  if (mins <= 0) return 'instant';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Human duration from seconds. */
export function formatSeconds(secs: number): string {
  if (secs <= 0) return 'done';
  const s = Math.floor(secs % 60);
  const m = Math.floor((secs / 60) % 60);
  const h = Math.floor(secs / 3600);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Time remaining until an ISO timestamp, as a short label.
 * Returns { done, label, seconds }.
 */
export function timeRemaining(endsAt: string | null | undefined, now: number = Date.now()): {
  done: boolean;
  seconds: number;
  label: string;
} {
  if (!endsAt) return { done: true, seconds: 0, label: '-' };
  const end = new Date(endsAt).getTime();
  const secs = Math.max(0, Math.round((end - now) / 1000));
  return { done: secs <= 0, seconds: secs, label: secs <= 0 ? 'ready' : formatSeconds(secs) };
}
