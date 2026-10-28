import { addDays } from "../isoDate";
import { easterSunday } from "./easter";
import { PublicHolidayId } from "./holidayIds";
import type { SpecialDay } from "./publicHolidays";

const NorwegianHolidayId = {
  PalmSunday: "palm-sunday",
  ConstitutionDay: "constitution-day",
  WhitMonday: "whit-monday",
} as const;

export function getNorwegianPublicHolidays(year: number): SpecialDay[] {
  const easter = easterSunday(year);

  return [
    {
      date: `${year}-01-01`,
      name: "Første nyttårsdag",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsDay,
      emoji: "🎆",
    },
    {
      date: addDays(easter, -7),
      name: "Palmesøndag",
      type: "public-holiday",
      id: NorwegianHolidayId.PalmSunday,
      emoji: "🌿",
    },
    {
      date: addDays(easter, -3),
      name: "Skjærtorsdag",
      type: "public-holiday",
      id: PublicHolidayId.MaundyThursday,
      emoji: "🐣",
    },
    {
      date: addDays(easter, -2),
      name: "Langfredag",
      type: "public-holiday",
      id: PublicHolidayId.GoodFriday,
      emoji: "✝️",
    },
    {
      date: easter,
      name: "Første påskedag",
      type: "public-holiday",
      id: PublicHolidayId.EasterSunday,
      emoji: "🐣",
    },
    {
      date: addDays(easter, 1),
      name: "Andre påskedag",
      type: "public-holiday",
      id: PublicHolidayId.EasterMonday,
      emoji: "🐣",
    },
    {
      date: addDays(easter, 39),
      name: "Kristi himmelfartsdag",
      type: "public-holiday",
      id: PublicHolidayId.AscensionDay,
      emoji: "☁️",
    },
    {
      date: `${year}-05-01`,
      name: "Offentlig høytidsdag (1. mai)",
      type: "public-holiday",
      id: PublicHolidayId.LabourDay,
      emoji: "🛠️",
    },
    {
      date: `${year}-05-17`,
      name: "Grunnlovsdag (17. mai)",
      type: "public-holiday",
      id: NorwegianHolidayId.ConstitutionDay,
      emoji: "🇳🇴",
    },
    {
      date: addDays(easter, 49),
      name: "Første pinsedag",
      type: "public-holiday",
      id: PublicHolidayId.WhitSunday,
      emoji: "🕊️",
    },
    {
      date: addDays(easter, 50),
      name: "Andre pinsedag",
      type: "public-holiday",
      id: NorwegianHolidayId.WhitMonday,
      emoji: "🕊️",
    },
    {
      date: `${year}-12-24`,
      name: "Julaften",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasEve,
      emoji: "🎄",
    },
    {
      date: `${year}-12-25`,
      name: "Første juledag",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasDay,
      emoji: "🎄",
    },
    {
      date: `${year}-12-26`,
      name: "Andre juledag",
      type: "public-holiday",
      id: PublicHolidayId.BoxingDay,
      emoji: "🎄",
    },
    {
      date: `${year}-12-31`,
      name: "Nyttårsaften",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsEve,
      emoji: "🎆",
    },
  ];
}
