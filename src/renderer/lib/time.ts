/** Date helpers. kasas timestamps are ISO-8601 strings, so `new Date(iso)` works. */

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const relFmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** "3 minutes ago", "in 2 days", etc. Accepts an ISO string or a Date. */
export function fromNow(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const diffSec = (date.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  for (const [unit, secs] of UNITS) {
    if (abs >= secs || unit === 'second') {
      return relFmt.format(Math.round(diffSec / secs), unit);
    }
  }
  return relFmt.format(0, 'second');
}

/** "2026-06" bucket key for grouping by month. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "Jun 2026" from a "2026-06" key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(
    new Date(y, (m ?? 1) - 1, 1),
  );
}
