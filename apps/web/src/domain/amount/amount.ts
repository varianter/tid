/** In the currency's own decimals, like "5 071 662,50" for kroner, with no currency named. */
function withoutCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency })
    .formatToParts(amount)
    .filter((part) => part.type !== "currency")
    .map((part) => part.value)
    .join("")
    .trim();
}

// Every amount reads one way, in one of these styles. Pick one of them over adding another.
const styles = {
  /**
   * Like "5 071 662,50", for amounts in the one currency a page or document is about, such as a
   * rate or an invoice. Name the currency once where the amounts are, such as in their label,
   * since repeating it on each is only noise.
   */
  exact: withoutCurrency,
  /**
   * Like "5 071 663 SEK", in whole units, for where amounts in different currencies meet. The code,
   * since Norwegian and Swedish kroner are both "kr".
   */
  withCurrency: (amount: number, currency: string) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 0,
    }).format(amount),
};

export type AmountStyle = keyof typeof styles;

/** No default style, since only the caller knows whether other currencies are in sight. */
export function formatAmount(amount: number, currency: string, style: AmountStyle) {
  return styles[style](amount, currency);
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

/** Adds up amounts that each carry their own currency. Ones without a currency or amount bill nothing. */
export function sumAmounts(items: { amount: number; currency: string | null }[]): Amounts {
  return items.reduce<Amounts>(
    (sum, { amount, currency }) =>
      currency && amount !== 0 ? addAmounts(sum, { [currency]: amount }) : sum,
    {},
  );
}

/** One amount per currency, so nothing is converted. Zero in `fallbackCurrency` when empty. */
export function formatAmounts(amounts: Amounts, fallbackCurrency: string) {
  const nonZero = Object.entries(amounts).filter(([, amount]) => amount !== 0);
  if (nonZero.length === 0) return formatAmount(0, fallbackCurrency, "withCurrency");
  return nonZero
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amount]) => formatAmount(amount, currency, "withCurrency"))
    .join(" · ");
}
