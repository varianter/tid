import { addDays, parseIsoDate } from "../isoDate";
import { easterSunday } from "./easter";
import { PublicHolidayId } from "./holidayIds";
import type { SpecialDay } from "./publicHolidays";

const SwedishHolidayId = {
  Epiphany: "epiphany",
  EasterEve: "easter-eve",
  WhitEve: "whit-eve",
  NationalDay: "national-day",
  MidsummerEve: "midsummer-eve",
  MidsummerDay: "midsummer-day",
  AllSaintsDay: "all-saints-day",
} as const;

function saturdayOnOrAfter(isoDate: string) {
  return addDays(isoDate, (6 - parseIsoDate(isoDate).getUTCDay() + 7) % 7);
}

export function getSwedishPublicHolidays(year: number): SpecialDay[] {
  const easter = easterSunday(year);
  const midsummer = saturdayOnOrAfter(`${year}-06-20`);
  const allSaints = saturdayOnOrAfter(`${year}-10-31`);

  return [
    {
      date: `${year}-01-01`,
      name: "Nyårsdagen",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsDay,
      emoji: "🎆",
    },
    {
      date: `${year}-01-06`,
      name: "Trettondedag jul",
      type: "public-holiday",
      id: SwedishHolidayId.Epiphany,
      emoji: "⭐",
    },
    {
      date: addDays(easter, -3),
      name: "Skärtorsdagen",
      type: "public-holiday",
      id: PublicHolidayId.MaundyThursday,
      emoji: "🐣",
    },
    {
      date: addDays(easter, -2),
      name: "Långfredagen",
      type: "public-holiday",
      id: PublicHolidayId.GoodFriday,
      emoji: "✝️",
    },
    {
      date: addDays(easter, -1),
      name: "Påskafton",
      type: "public-holiday",
      id: SwedishHolidayId.EasterEve,
      emoji: "🐣",
    },
    {
      date: easter,
      name: "Påskdagen",
      type: "public-holiday",
      id: PublicHolidayId.EasterSunday,
      emoji: "🐣",
    },
    {
      date: addDays(easter, 1),
      name: "Annandag påsk",
      type: "public-holiday",
      id: PublicHolidayId.EasterMonday,
      emoji: "🐣",
    },
    {
      date: `${year}-05-01`,
      name: "Första maj",
      type: "public-holiday",
      id: PublicHolidayId.LabourDay,
      emoji: "🛠️",
    },
    {
      date: addDays(easter, 39),
      name: "Kristi himmelsfärdsdag",
      type: "public-holiday",
      id: PublicHolidayId.AscensionDay,
      emoji: "☁️",
    },
    {
      date: addDays(easter, 48),
      name: "Pingstafton",
      type: "public-holiday",
      id: SwedishHolidayId.WhitEve,
      emoji: "🕊️",
    },
    {
      date: addDays(easter, 49),
      name: "Pingstdagen",
      type: "public-holiday",
      id: PublicHolidayId.WhitSunday,
      emoji: "🕊️",
    },
    {
      date: `${year}-06-06`,
      name: "Sveriges nationaldag",
      type: "public-holiday",
      id: SwedishHolidayId.NationalDay,
      emoji: "🇸🇪",
    },
    {
      date: addDays(midsummer, -1),
      name: "Midsommarafton",
      type: "public-holiday",
      id: SwedishHolidayId.MidsummerEve,
      emoji: "🌼",
    },
    {
      date: midsummer,
      name: "Midsommardagen",
      type: "public-holiday",
      id: SwedishHolidayId.MidsummerDay,
      emoji: "🌼",
    },
    {
      date: allSaints,
      name: "Alla helgons dag",
      type: "public-holiday",
      id: SwedishHolidayId.AllSaintsDay,
      emoji: "🕯️",
    },
    {
      date: `${year}-12-24`,
      name: "Julafton",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasEve,
      emoji: "🎄",
    },
    {
      date: `${year}-12-25`,
      name: "Juldagen",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasDay,
      emoji: "🎄",
    },
    {
      date: `${year}-12-26`,
      name: "Annandag jul",
      type: "public-holiday",
      id: PublicHolidayId.BoxingDay,
      emoji: "🎄",
    },
    {
      date: `${year}-12-31`,
      name: "Nyårsafton",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsEve,
      emoji: "🎆",
    },
  ];
}
