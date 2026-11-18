import { getNorwegianPublicHolidays } from "./norway";
import { getSwedishPublicHolidays } from "./sweden";

export type Country = "NO" | "SE";

export interface SpecialDay {
  date: Temporal.PlainDate;
  id: string;
  name: string;
  emoji: string;
  type: "public-holiday";
}

export function getPublicHolidays(year: number, country: Country): SpecialDay[] {
  switch (country) {
    case "NO":
      return getNorwegianPublicHolidays(year);
    case "SE":
      return getSwedishPublicHolidays(year);
  }
}
