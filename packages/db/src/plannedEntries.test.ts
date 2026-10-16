import { expect, test } from "bun:test";
import { type Person, people, syntheticPeople } from "./fixtureData";
import { plannedDay, plannedEntries } from "./plannedEntries";
import { dayOf, todayIso, Weekday } from "./week";

// A fixed Wednesday, so the dates the fixture expands to are predictable.
const now = new Date("2026-10-14T12:00:00Z");

const person = (overrides: Partial<Person> = {}): Person => ({
  name: "Test Person",
  email: "test.person@example.com",
  organization: "trondheim",
  usualDay: { vacation: 7.5 },
  ...overrides,
});

test("plannedDay returns the usual day on a workday", () => {
  expect(plannedDay(person(), 0, Weekday.Monday)?.hours).toEqual({ vacation: 7.5 });
});

test("plannedDay returns nothing on a day the person doesn't work", () => {
  const partTime = person({ weekdays: [Weekday.Monday, Weekday.Wednesday] });
  expect(plannedDay(partTime, 0, Weekday.Tuesday)).toBeUndefined();
  expect(plannedDay(partTime, 0, Weekday.Wednesday)?.hours).toEqual({ vacation: 7.5 });
});

test("plannedDay prefers a personal exception over the usual day", () => {
  const onVacation = person({
    usualDay: { betweenProjects: 7.5 },
    exceptions: [{ from: -2, hours: { vacation: 7.5 } }],
  });
  expect(plannedDay(onVacation, -2, Weekday.Monday)?.hours).toEqual({ vacation: 7.5 });
  expect(plannedDay(onVacation, -1, Weekday.Monday)?.hours).toEqual({ betweenProjects: 7.5 });
});

test("plannedDay falls back to the company-wide exception", () => {
  expect(plannedDay(person(), -7, Weekday.Friday)?.hours).toEqual({ variantDay: 7.5 });
});

test("an empty exception is a day with no entries, not the usual day", () => {
  const forgot = person({
    usualDay: { vacation: 7.5 },
    exceptions: [{ from: -1, hours: {} }],
  });
  expect(plannedDay(forgot, -1, Weekday.Monday)?.hours).toEqual({});
  const entries = plannedEntries(forgot, now);
  expect(entries.some((entry) => entry.spentOn === dayOf(now, -1, Weekday.Monday))).toBe(false);
});

test("plannedEntries turns hours into minutes and carries the day's note", () => {
  const shortDay = person({
    exceptions: [
      { from: -3, weekdays: [Weekday.Saturday], hours: { vacation: 2 }, notes: "Short day" },
    ],
  });
  const saturday = plannedEntries(shortDay, now).find(
    (entry) => entry.spentOn === dayOf(now, -3, Weekday.Saturday),
  );
  expect(saturday?.minutes).toBe(120);
  expect(saturday?.notes).toBe("Short day");
});

test("plannedEntries starts at the week the person joined", () => {
  const joiner = person({ joinedWeek: -1 });
  const entries = plannedEntries(joiner, now);
  const joinedMonday = dayOf(now, -1, Weekday.Monday);
  expect(entries.every((entry) => entry.spentOn >= joinedMonday)).toBe(true);
  expect(entries.some((entry) => entry.spentOn === joinedMonday)).toBe(true);
});

test("plannedEntries stops at the week the person left", () => {
  const leaver = person({ leftWeek: -2 });
  const entries = plannedEntries(leaver, now);
  const lastWeekSunday = dayOf(now, -2, Weekday.Sunday);
  expect(entries.every((entry) => entry.spentOn <= lastWeekSunday)).toBe(true);
  expect(entries.some((entry) => entry.spentOn === dayOf(now, -2, Weekday.Friday))).toBe(true);
});

test("plannedEntries never logs today or the future", () => {
  const entries = plannedEntries(person(), now);
  expect(entries.at(-1)?.spentOn).toBe(dayOf(now, 0, Weekday.Tuesday));
  expect(entries.every((entry) => entry.spentOn < todayIso(now))).toBe(true);
});

test("plannedEntries fills the whole requested history", () => {
  const startWeek = -260;
  const entries = plannedEntries(person(), now, startWeek);
  expect(entries[0]?.spentOn).toBe(dayOf(now, startWeek, Weekday.Monday));
  expect(entries.at(-1)?.spentOn).toBe(dayOf(now, 0, Weekday.Tuesday));
});

test("plannedEntries rejects billable work the person isn't assigned to", () => {
  const unassigned = person({ usualDay: { portalDevelopment: 7.5 } });
  expect(() => plannedEntries(unassigned, now)).toThrow(/without being assigned/);
});

test("plannedEntries rejects logging on a task after it ended", () => {
  const overdue = person({
    usualDay: { portalPrestudy: 7.5 },
    assignments: [{ project: "LYS1001", rates: [{ rate: 1500 }] }],
  });
  expect(() => plannedEntries(overdue, now)).toThrow(/after it ended/);
});

test("every person in the fixture expands without violating a rule", () => {
  for (const person of people) {
    expect(() => plannedEntries(person, now)).not.toThrow();
  }
});

test("syntheticPeople makes distinct people on billable projects", () => {
  const extra = syntheticPeople(10);
  expect(extra).toHaveLength(10);
  expect(new Set(extra.map((person) => person.email)).size).toBe(10);
  for (const person of extra) {
    expect(person.assignments).toHaveLength(1);
    expect(["trondheim", "oslo"]).toContain(person.organization);
  }
});
