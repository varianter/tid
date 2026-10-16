import { getNorwegianPublicHolidays } from "./norway";
import { getSwedishPublicHolidays } from "./sweden";

export type Country = "NO" | "SE";

export interface SpecialDay {
  date: string;
  id: string;
  name: string;
  type: "public-holiday";
}

export function getPublicHolidays(
  year: number = new Date().getFullYear(),
  country: Country = "NO",
): SpecialDay[] {
  switch (country) {
    case "NO":
      return getNorwegianPublicHolidays(year);
    case "SE":
      return getSwedishPublicHolidays(year);
  }
}
