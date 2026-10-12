const hoursFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 });

/** Hours in Norwegian notation (450 → "7,5"). Zero is blank, like an empty cell. */
export function formatHours(minutes: number) {
  return minutes === 0 ? "" : hoursFormat.format(minutes / 60);
}
