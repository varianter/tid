const hoursFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });

/** Hours in Norwegian notation (450 → "7,5"). Zero is blank, like an empty cell. */
export function formatHours(minutes: number) {
  return minutes === 0 ? "" : hoursFormat.format(minutes / 60);
}

/** Unlike a timesheet cell, an empty total still reads as zero. */
export function formatTotalHours(minutes: number) {
  return `${formatHours(minutes) || "0"}\u00a0h`;
}

// Decimal hours ("7,5" or "7.5") or a clock duration ("7:30"), as the server accepts them.
const typedHours = /^(\d+)(?:[.,](\d+)|:([0-5]\d))?$/;

/** Typed hours as minutes. Blank is zero; text that isn't hours is undefined. */
export function parseHours(text: string) {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const match = typedHours.exec(trimmed);
  if (!match) return undefined;
  const [, hours, fraction, minutes] = match;
  return minutes === undefined
    ? Math.round(Number(`${hours}.${fraction ?? 0}`) * 60)
    : Number(hours) * 60 + Number(minutes);
}
