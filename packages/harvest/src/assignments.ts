import type { HarvestExport } from "./harvestExport";
import type { Findings, ImportPlan } from "./plan";
import type { Person } from "./users";

// Who may log time where today, at the rate Harvest bills them. Harvest only knows today's rate,
// so it's valid from when the person was assigned.
export function readAssignments(
  harvestExports: HarvestExport[],
  codeByHarvestProject: Map<string, string>,
  slugByAccount: Map<number, string>,
  { warnings }: Findings,
) {
  return harvestExports.flatMap((harvestExport) => {
    const { account, projects, users, userAssignments, timeEntries } = harvestExport;
    const rates = projectRates(harvestExport);
    return userAssignments.flatMap((assignment) => {
      const code = codeByHarvestProject.get(`${account.id}:${assignment.project.id}`);
      const project = projects.find((candidate) => candidate.id === assignment.project.id);
      const user = users.find((candidate) => candidate.id === assignment.user.id);
      // Nobody logs time on archived projects or as a deactivated user.
      if (!code || !project?.is_active || !user?.is_active) return [];
      const email = user.email.toLowerCase();
      const slug = slugByAccount.get(account.id);
      const since = assignment.created_at.slice(0, 10);
      if (project.bill_by === "People") {
        const rate = assignment.use_default_rates
          ? user.default_hourly_rate
          : assignment.hourly_rate;
        return [{ email, code, slug, rate, since, pricedByTask: false }];
      }
      if (!rates.pricedByTask.has(project.id)) {
        const rate = rates.byProject.get(project.id) ?? null;
        return [{ email, code, slug, rate, since, pricedByTask: false }];
      }

      // A person's task is their level or the year's price, so they keep the rate they were last
      // billed at. Without history, they get theirs set by hand.
      const billed = timeEntries
        .filter(
          (entry) =>
            entry.project.id === project.id &&
            entry.user.id === user.id &&
            entry.billable_rate !== null,
        )
        .toSorted((a, b) => a.spent_date.localeCompare(b.spent_date));
      const rate = billed.at(-1)?.billable_rate ?? null;
      // A price increase is fine: the rate only rises, from one day to the next. Anything else
      // suggests levels used side by side, which one rate can't hold.
      const risesOnly = billed.every((entry, index) => {
        const previous = billed[index - 1];
        if (!previous || entry.billable_rate === previous.billable_rate) return true;
        return (
          (entry.billable_rate as number) > (previous.billable_rate as number) &&
          entry.spent_date > previous.spent_date
        );
      });
      if (!risesOnly) {
        const billedRates = [...new Set(billed.map((entry) => entry.billable_rate))];
        warnings.push({
          kind: "ratesNotRising",
          email: user.email,
          project: code,
          rates: billedRates as number[],
          kept: rate as number,
        });
      }
      return [{ email, code, slug, rate, since, pricedByTask: true }];
    });
  });
}

// The rate a project charges everyone on it, unless it charges each person their own or prices
// its tasks differently, where a task stands for a level or a year's price.
function projectRates({ projects, taskAssignments }: HarvestExport) {
  const byProject = new Map<number, number | null>();
  const pricedByTask = new Set<number>();
  for (const project of projects) {
    if (project.bill_by === "Project") byProject.set(project.id, project.hourly_rate);
    if (project.bill_by !== "Tasks") continue;
    const taskRates = [
      ...new Set(
        taskAssignments
          .filter((task) => task.project.id === project.id && task.billable)
          .flatMap((task) => (task.hourly_rate === null ? [] : [task.hourly_rate])),
      ),
    ];
    if (taskRates.length > 1) pricedByTask.add(project.id);
    else byProject.set(project.id, taskRates[0] ?? null);
  }
  return { byProject, pricedByTask };
}

// One assignment per person and project, however many accounts it's in.
export function planAssignments(
  assignments: ReturnType<typeof readAssignments>,
  projectsByCode: Map<string, ImportPlan["projects"][number]>,
  fixedFeeCodes: Set<string>,
  people: Map<string, Person>,
  { problems, warnings }: Findings,
) {
  return [...Map.groupBy(assignments, ({ code, email }) => `${code}|${email}`).values()].flatMap(
    (sameAssignment) => {
      const { code, email } = sameAssignment[0] as (typeof assignments)[number];
      const project = projectsByCode.get(code) as ImportPlan["projects"][number];
      if (project.openToEveryone) return [];
      const person = people.get(email) as Person;
      const rates = [
        ...new Set(sameAssignment.flatMap(({ rate }) => (rate === null ? [] : [rate]))),
      ];
      if (rates.length > 1) {
        problems.push(
          `${person.email} has different rates on project ${code} in different accounts (${rates.join(", ")}).`,
        );
      }
      const [rate] = rates;
      if (rate === undefined && project.billable && !fixedFeeCodes.has(code)) {
        warnings.push({
          kind: sameAssignment.some((assignment) => assignment.pricedByTask)
            ? "noRatePricedByTask"
            : "noRate",
          email: person.email,
          client: project.client,
          project: code,
        });
      }
      const validFrom = sameAssignment.map(({ since }) => since).toSorted()[0] as string;
      return [
        {
          project: code,
          email: person.email,
          rates: rate === undefined ? [] : [{ validFrom, rate: Math.round(rate * 100) }],
        },
      ];
    },
  );
}
