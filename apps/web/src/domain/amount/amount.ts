export function formatAmount(amount: number, currency: string, fractionDigits = 0) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Sums in several currencies, which can't be added without an exchange rate. */
export type Amounts = Record<string, number>;

export function addAmounts(left: Amounts, right: Amounts): Amounts {
  const sum = { ...left };
  for (const [currency, amount] of Object.entries(right)) {
    sum[currency] = (sum[currency] ?? 0) + amount;
  }
  return sum;
}

/** One amount per currency, so nothing is converted. Zero in `fallbackCurrency` when empty. */
export function formatAmounts(amounts: Amounts, fallbackCurrency: string) {
  const nonZero = Object.entries(amounts).filter(([, amount]) => amount !== 0);
  if (nonZero.length === 0) return formatAmount(0, fallbackCurrency);
  return nonZero
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatAmount(amount, currency))
    .join(" · ");
}
