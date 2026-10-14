const percentFormat = new Intl.NumberFormat("nb-NO", { style: "percent" });

/** Blank when there's nothing to take a share of, rather than NaN or Infinity. */
export function formatShare(part: number, whole: number) {
  return whole === 0 ? "" : percentFormat.format(part / whole);
}
