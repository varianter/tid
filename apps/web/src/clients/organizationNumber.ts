import type { Country } from "@tid/lookup-nordic-company";
import { z } from "zod";

// Stored as digits only, so one company can't be entered twice in different formats. Only a
// register lookup proves a number right, so this checks no more than which register to ask.

/** The country whose register has the company: Norway's numbers have 9 digits, Sweden's 10. */
export function countryOf(digits: string): Country | undefined {
  if (/^\d{9}$/.test(digits)) return "NO";
  if (/^\d{10}$/.test(digits)) return "SE";
  return undefined;
}

/** As each country writes it: "974 760 673" in Norway, "556012-5790" in Sweden. */
export function formatOrganizationNumber(digits: string) {
  switch (countryOf(digits)) {
    case "NO":
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    case "SE":
      return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    default:
      return digits;
  }
}

/** A typed organization number, read as the digits stored, as in "NO 974 760 673 MVA". */
export const organizationNumberDigits = z
  .string()
  .transform((typed) => typed.replace(/\D/g, ""))
  .refine(
    (digits) => countryOf(digits) !== undefined,
    "Enter 9 digits for a Norwegian number or 10 for a Swedish one",
  );

export const organizationNumberTaken = "Another client has this organization number";
