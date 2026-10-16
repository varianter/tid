import { addDays, parseIsoDate } from "../isoDate";
import { easterSunday } from "./easter";
import { PublicHolidayId } from "./holidayIds";
import type { SpecialDay } from "./publicHolidays";

export const SwedishHolidayId = {
  EpiphanyEve: "epiphany-eve",
  Epiphany: "epiphany",
  EasterEve: "easter-eve",
  WhitEve: "whit-eve",
  NationalDay: "national-day",
  MidsummerEve: "midsummer-eve",
  MidsummerDay: "midsummer-day",
  AllSaintsEve: "all-saints-eve",
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
    },
    {
      date: `${year}-01-05`,
      name: "Trettondagsafton",
      type: "public-holiday",
      id: SwedishHolidayId.EpiphanyEve,
    },
    {
      date: `${year}-01-06`,
      name: "Trettondedag jul",
      type: "public-holiday",
      id: SwedishHolidayId.Epiphany,
    },
    {
      date: addDays(easter, -3),
      name: "Skärtorsdagen",
      type: "public-holiday",
      id: PublicHolidayId.MaundyThursday,
    },
    {
      date: addDays(easter, -2),
      name: "Långfredagen",
      type: "public-holiday",
      id: PublicHolidayId.GoodFriday,
    },
    {
      date: addDays(easter, -1),
      name: "Påskafton",
      type: "public-holiday",
      id: SwedishHolidayId.EasterEve,
    },
    {
      date: easter,
      name: "Påskdagen",
      type: "public-holiday",
      id: PublicHolidayId.EasterSunday,
    },
    {
      date: addDays(easter, 1),
      name: "Annandag påsk",
      type: "public-holiday",
      id: PublicHolidayId.EasterMonday,
    },
    {
      date: `${year}-05-01`,
      name: "Första maj",
      type: "public-holiday",
      id: PublicHolidayId.LabourDay,
    },
    {
      date: addDays(easter, 39),
      name: "Kristi himmelsfärdsdag",
      type: "public-holiday",
      id: PublicHolidayId.AscensionDay,
    },
    {
      date: addDays(easter, 48),
      name: "Pingstafton",
      type: "public-holiday",
      id: SwedishHolidayId.WhitEve,
    },
    {
      date: addDays(easter, 49),
      name: "Pingstdagen",
      type: "public-holiday",
      id: PublicHolidayId.WhitSunday,
    },
    {
      date: `${year}-06-06`,
      name: "Sveriges nationaldag",
      type: "public-holiday",
      id: SwedishHolidayId.NationalDay,
    },
    {
      date: addDays(midsummer, -1),
      name: "Midsommarafton",
      type: "public-holiday",
      id: SwedishHolidayId.MidsummerEve,
    },
    {
      date: midsummer,
      name: "Midsommardagen",
      type: "public-holiday",
      id: SwedishHolidayId.MidsummerDay,
    },
    {
      date: addDays(allSaints, -1),
      name: "Alla helgons afton",
      type: "public-holiday",
      id: SwedishHolidayId.AllSaintsEve,
    },
    {
      date: allSaints,
      name: "Alla helgons dag",
      type: "public-holiday",
      id: SwedishHolidayId.AllSaintsDay,
    },
    {
      date: `${year}-12-24`,
      name: "Julafton",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasEve,
    },
    {
      date: `${year}-12-25`,
      name: "Juldagen",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasDay,
    },
    {
      date: `${year}-12-26`,
      name: "Annandag jul",
      type: "public-holiday",
      id: PublicHolidayId.BoxingDay,
    },
    {
      date: `${year}-12-31`,
      name: "Nyårsafton",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsEve,
    },
  ];
}
