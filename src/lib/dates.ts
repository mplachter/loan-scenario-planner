// Dates are stored as "YYYY-MM-DD" strings so they survive JSON.stringify
// into localStorage and stay diffable. All month arithmetic uses Date.UTC to
// avoid local-timezone drift (a `new Date("2029-03-01")` in a negative-offset
// timezone renders as Feb 28 with local-time constructors).

export function todayISO(): string {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

// m is 1-indexed
export function toISO(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export function daysInMonthUTC(y: number, m: number): number {
  // Day 0 of month m+1 is the last day of month m (m is 1-indexed).
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonthsISO(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso);
  const total = y * 12 + (m - 1) + months;
  const newY = Math.floor(total / 12);
  const newM = total - newY * 12 + 1;
  const newD = Math.min(d, daysInMonthUTC(newY, newM));
  return toISO(newY, newM, newD);
}

export function monthsBetweenISO(fromISO: string, toISO_: string): number {
  const a = parseISO(fromISO);
  const b = parseISO(toISO_);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function firstOfMonthISO(iso: string): string {
  const { y, m } = parseISO(iso);
  return toISO(y, m, 1);
}

// Mortgages skip a month: close March 15 -> first payment May 1.
export function firstPaymentDateFor(closeDateISO: string): string {
  return addMonthsISO(firstOfMonthISO(closeDateISO), 2);
}

// month is 1-indexed; month 1 is the first payment date itself.
export function monthToDateISO(firstPaymentISO: string, month: number): string {
  return addMonthsISO(firstPaymentISO, month - 1);
}

// Inverse of monthToDateISO. May return <= 0 for dates before the first
// payment date — callers decide whether/how to clamp.
export function dateToMonthISO(firstPaymentISO: string, iso: string): number {
  return monthsBetweenISO(firstPaymentISO, iso) + 1;
}

export function formatMonthYear(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  });
}

export function formatFullDate(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
