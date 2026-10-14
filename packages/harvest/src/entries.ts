import type { HarvestExport } from "./harvestExport";
import type { Findings, ImportPlan } from "./plan";
import type { Person } from "./users";

// Harvest's entries, with the user and project they belong to in Tid.
export function readEntries(
  harvestExports: HarvestExport[],
  emailByHarvestUser: Map<string, string>,
  codeByHarvestProject: Map<string, string>,
  slugByAccount: Map<number, string>,
  { problems }: Findings,
) {
  return harvestExports.flatMap(({ account, timeEntries }) =>
    timeEntries.flatMap((entry) => {
      const email = emailByHarvestUser.get(`${account.id}:${entry.user.id}`);
      const code = codeByHarvestProject.get(`${account.id}:${entry.project.id}`);
      if (!email) {
        problems.push(`${account.name}: an entry on ${entry.spent_date} has an unknown user.`);
        return [];
      }
      // Its project was reported already, so its entries don't need reporting one by one.
      if (!code) return [];
      const slug = slugByAccount.get(account.id);
      return [{ ...entry, account, email, code, slug, minutes: entry.hours * 60 }];
    }),
  );
}

// One entry per user, task and day: Harvest's entries are summed and their notes joined.
export function planEntries(
  entries: ReturnType<typeof readEntries>,
  projects: ImportPlan["projects"],
  people: Map<string, Person>,
  { problems, warnings }: Findings,
) {
  for (const project of projects) {
    const nonBillable = entries.filter((entry) => entry.code === project.code && !entry.billable);
    if (project.billable && nonBillable.length > 0) {
      warnings.push(
        `Project ${project.code} has ${nonBillable.length} non-billable entries, which export as billable.`,
      );
    }
  }

  return [
    ...Map.groupBy(
      entries,
      (entry) => `${entry.email}|${entry.code}|${entry.task.name}|${entry.spent_date}`,
    ).values(),
  ].map((sameDay) => {
    const first = sameDay[0] as (typeof entries)[number];
    const email = people.get(first.email)?.email ?? first.email;
    const minutes = Math.round(sameDay.reduce((total, entry) => total + entry.hours, 0) * 60);
    const describeDay = () =>
      `${email} on ${first.code} / ${first.task.name} on ${first.spent_date}`;
    if (minutes > 24 * 60) {
      problems.push(
        `${first.account.name}: ${email} logged more than 24 hours on ` +
          `${first.code} / ${first.task.name} on ${first.spent_date}.`,
      );
    }
    const notes = sameDay.flatMap((entry) => (entry.notes?.trim() ? [entry.notes.trim()] : []));
    const rated = sameDay.filter((entry) => entry.billable_rate !== null);
    const prices = [
      ...new Set(rated.map((entry) => `${entry.billable_rate} ${entry.client.currency}`)),
    ];
    if (prices.length > 1) {
      problems.push(
        `${first.account.name}: ${describeDay()} has entries at different rates (${prices.join(", ")}), ` +
          "which can't be merged into one entry.",
      );
    }
    if (rated.length > 0 && rated.length < sameDay.length) {
      warnings.push(`${describeDay()} mixes rated and unrated entries; the merged entry is rated.`);
    }
    const [price] = rated;
    return {
      email,
      project: first.code,
      task: first.task.name,
      spentOn: first.spent_date,
      minutes,
      notes: notes.length > 0 ? notes.join("\n") : null,
      rate: price ? Math.round((price.billable_rate as number) * 100) : null,
      currency: price ? price.client.currency : null,
    };
  });
}
