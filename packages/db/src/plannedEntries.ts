import { isoDateInOslo } from "@tid/calendar/osloClock";
import {
  companyWideExceptions,
  type Exception,
  openCountries,
  organizationCountries,
  type Person,
  type ProjectDefinition,
  projectCatalog,
  recentStartWeek,
  type TaskDefinition,
  type TaskKey,
  taskCatalog,
} from "./fixtureData";
import { dayOf, type Weekday, weekdays, workWeek } from "./week";

export function plannedDay(
  person: Person,
  week: number,
  weekday: Weekday,
): Pick<Exception, "hours" | "notes"> | undefined {
  const workdays = person.weekdays ?? workWeek;
  const applies = (exception: Exception) =>
    week >= exception.from &&
    week <= (exception.to ?? exception.from) &&
    (exception.weekdays ?? workdays).includes(weekday);
  const exception =
    person.exceptions?.find(applies) ??
    companyWideExceptions[organizationCountries[person.organization]].find(
      (exception) => applies(exception) && workdays.includes(weekday),
    );
  if (exception) return { hours: exception.hours, notes: exception.notes };
  return workdays.includes(weekday) ? { hours: person.usualDay } : undefined;
}

// Throws when the fixture breaks a rule the app relies on, so a bad edit fails the seed test.
export function plannedEntries(person: Person, now: Date, startWeek: number = recentStartWeek) {
  const today = isoDateInOslo(now);
  const entries: { task: TaskKey; spentOn: string; minutes: number; notes?: string }[] = [];
  for (let week = Math.max(startWeek, person.joinedWeek ?? startWeek); week <= 0; week++) {
    if (person.leftWeek !== undefined && week > person.leftWeek) break;
    for (const weekday of weekdays) {
      const spentOn = dayOf(now, week, weekday);
      if (spentOn >= today) break;
      const day = plannedDay(person, week, weekday);
      for (const [task, hours] of Object.entries(day?.hours ?? {}) as [TaskKey, number][]) {
        const definition: TaskDefinition = taskCatalog[task];
        const project: ProjectDefinition = projectCatalog[definition.project];
        const isAssigned = person.assignments?.some(
          (assignment) => assignment.project === definition.project,
        );
        if (project.billing !== "non_billable" && !isAssigned) {
          throw new Error(
            `${person.name} logs ${task} in week ${week} (${spentOn}) without being assigned to ${definition.project}`,
          );
        }
        const country = organizationCountries[person.organization];
        if (project.billing === "non_billable" && !openCountries(project).includes(country)) {
          throw new Error(
            `${person.name} logs ${task} in week ${week} (${spentOn}) on ${definition.project}, which isn't open in ${country}`,
          );
        }
        const endsWeek = definition.endsWeek ?? project.endsWeek;
        if (endsWeek !== undefined && week > endsWeek) {
          throw new Error(
            `${person.name} logs ${task} in week ${week} (${spentOn}) after it ended in week ${endsWeek}`,
          );
        }
        entries.push({ task, spentOn, minutes: Math.round(hours * 60), notes: day?.notes });
      }
    }
  }
  return entries;
}
