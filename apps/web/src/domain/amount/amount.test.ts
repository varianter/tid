import { expect, test } from "bun:test";
import { formatAmount } from "./amount";

// Intl groups thousands with a non-breaking space.
const plainSpaces = (text: string) => text.replace(/\s/g, " ");

test("an exact amount never names its currency, while one among others names it by code", () => {
  expect(plainSpaces(formatAmount(5071662.5, "SEK", "exact"))).toBe("5 071 662,50");
  expect(plainSpaces(formatAmount(5071662.5, "NOK", "exact"))).toBe("5 071 662,50");
  expect(plainSpaces(formatAmount(5071662.5, "SEK", "withCurrency"))).toBe("5 071 663 SEK");
});
