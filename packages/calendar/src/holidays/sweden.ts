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

function saturdayOnOrAfter(day: Temporal.PlainDate) {
  return day.add({ days: (6 - day.dayOfWeek + 7) % 7 });
}

export function getSwedishPublicHolidays(year: number): SpecialDay[] {
  const easter = easterSunday(year);
  const on = (month: number, day: number) => Temporal.PlainDate.from({ year, month, day });
  const midsummer = saturdayOnOrAfter(on(6, 20));
  const allSaints = saturdayOnOrAfter(on(10, 31));

  return [
    {
      date: on(1, 1),
      name: "Nyårsdagen",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsDay,
      emoji: "🎆",
    },
    {
      date: on(1, 6),
      name: "Trettondedag jul",
      type: "public-holiday",
      id: SwedishHolidayId.Epiphany,
      emoji: "⭐",
    },
    {
      date: easter.subtract({ days: 3 }),
      name: "Skärtorsdagen",
      type: "public-holiday",
      id: PublicHolidayId.MaundyThursday,
      emoji: "🐣",
    },
    {
      date: easter.subtract({ days: 2 }),
      name: "Långfredagen",
      type: "public-holiday",
      id: PublicHolidayId.GoodFriday,
      emoji: "✝️",
    },
    {
      date: easter.subtract({ days: 1 }),
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
      date: easter.add({ days: 1 }),
      name: "Annandag påsk",
      type: "public-holiday",
      id: PublicHolidayId.EasterMonday,
      emoji: "🐣",
    },
    {
      date: on(5, 1),
      name: "Första maj",
      type: "public-holiday",
      id: PublicHolidayId.LabourDay,
      emoji: "🛠️",
    },
    {
      date: easter.add({ days: 39 }),
      name: "Kristi himmelsfärdsdag",
      type: "public-holiday",
      id: PublicHolidayId.AscensionDay,
      emoji: "☁️",
    },
    {
      date: easter.add({ days: 48 }),
      name: "Pingstafton",
      type: "public-holiday",
      id: SwedishHolidayId.WhitEve,
      emoji: "🕊️",
    },
    {
      date: easter.add({ days: 49 }),
      name: "Pingstdagen",
      type: "public-holiday",
      id: PublicHolidayId.WhitSunday,
      emoji: "🕊️",
    },
    {
      date: on(6, 6),
      name: "Sveriges nationaldag",
      type: "public-holiday",
      id: SwedishHolidayId.NationalDay,
      emoji: "🇸🇪",
    },
    {
      date: midsummer.subtract({ days: 1 }),
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
      date: on(12, 24),
      name: "Julafton",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasEve,
      emoji: "🎄",
    },
    {
      date: on(12, 25),
      name: "Juldagen",
      type: "public-holiday",
      id: PublicHolidayId.ChristmasDay,
      emoji: "🎄",
    },
    {
      date: on(12, 26),
      name: "Annandag jul",
      type: "public-holiday",
      id: PublicHolidayId.BoxingDay,
      emoji: "🎄",
    },
    {
      date: on(12, 31),
      name: "Nyårsafton",
      type: "public-holiday",
      id: PublicHolidayId.NewYearsEve,
      emoji: "🎆",
    },
  ];
}
