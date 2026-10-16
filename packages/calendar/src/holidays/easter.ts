// The anonymous Gregorian algorithm (Meeus/Jones/Butcher).
export function easterSunday(year: number) {
  const goldenNumber = year % 19;
  const century = Math.floor(year / 100);
  const yearOfCentury = year % 100;
  const leapCenturies = Math.floor(century / 4);
  const moonCorrection = Math.floor((century + 8) / 25);
  const moonOrbitCorrection = Math.floor((century - moonCorrection + 1) / 3);
  const epact = (19 * goldenNumber + century - leapCenturies - moonOrbitCorrection + 15) % 30;
  const weekdayOffset =
    (32 + 2 * (century % 4) + 2 * Math.floor(yearOfCentury / 4) - epact - (yearOfCentury % 4)) % 7;
  const lateCorrection = Math.floor((goldenNumber + 11 * epact + 22 * weekdayOffset) / 451);
  const daysPastMarch22 = epact + weekdayOffset - 7 * lateCorrection;
  const month = Math.floor((daysPastMarch22 + 114) / 31);
  const day = ((daysPastMarch22 + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
