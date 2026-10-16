import { getNorwegianPublicHolidays } from "./norway";
import { getSwedishPublicHolidays } from "./sweden";

export type Country = "no" | "se";

export interface SpecialDay {
  date: string;
  id: string;
  name: string;
  type: "public-holiday";
}

export function getPublicHolidays(
  year: number = new Date().getFullYear(),
  country: Country = "no",
): SpecialDay[] {
  switch (country) {
    case "no":
      return getNorwegianPublicHolidays(year);
    case "se":
      return getSwedishPublicHolidays(year);
  }
}
