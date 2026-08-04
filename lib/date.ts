// Date helpers that mirror the schema's week bucketing.
// check_ins.local_date is the user's local calendar day (YYYY-MM-DD).

/** Today as a local YYYY-MM-DD string. */
export function todayLocal(ref = new Date()): string {
  return toLocalDate(ref);
}

export function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The start date of the current week, given the group's week_start_dow
 * (0 = Sunday, 1 = Monday). JS getDay() uses the same 0=Sun convention.
 */
export function weekStartDate(weekStartDow: number, ref = new Date()): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - weekStartDow + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** The 7 local dates of the current week, starting on week_start_dow. */
export function weekDates(weekStartDow: number, ref = new Date()): string[] {
  const start = weekStartDate(weekStartDow, ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toLocalDate(d);
  });
}

/** Single-letter labels for the week, aligned to week_start_dow. */
export function weekDayLabels(weekStartDow: number): string[] {
  const base = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, i) => base[(weekStartDow + i) % 7]);
}
