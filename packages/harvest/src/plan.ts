// Maps Harvest exports onto our tables, following the rules in README.md.
// Nothing here touches the database, so every problem is found before anything is written.

import type { billing } from "@tid/db/schema";
import { planAssignments, readAssignments } from "./assignments";
import { planEntries, readEntries } from "./entries";
import type { HarvestExport } from "./harvestExport";
import { type KnownOrganization, matchOrganizations } from "./organizations";
import { nameProjectsApart, planProjects } from "./projects";
import { mergePeople, placeUsers } from "./users";

export type Billing = (typeof billing.enumValues)[number];

// Rows refer to each other by email, client name, project code and organization slug; the
// writer resolves ids.
export type ImportPlan = {
  users: {
    email: string;
    name: string;
    organization: string;
    manager: boolean;
    // Shown when reviewing the import; the manager role is derived from them.
    harvestRoles: string[];
  }[];
  clients: string[];
  projects: {
    code: string;
    client: string;
    name: string;
    billing: Billing;
    openToEveryone: boolean;
    countsTowardBillableBase: boolean;
    startsOn: string | null;
    endsOn: string | null;
    organizations: string[];
    // The Harvest projects merged into it, by organization and code as Harvest has it.
    harvestProjects: { organization: string; code: string }[];
    // The organization slug the import offers as contract owner. Someone confirms it.
    suggestedOwner: string | null;
  }[];
  tasks: { project: string; name: string }[];
  assignments: { project: string; email: string; rates: { validFrom: string; rate: number }[] }[];
  entries: {
    email: string;
    project: string;
    task: string;
    spentOn: string;
    minutes: number;
    notes: string | null;
    // Harvest's billable rate, in minor units.
    rate: number | null;
    currency: string | null;
  }[];
};

// Things the import works around, for the person running it to check. Rates are Harvest's, in
// major units.
export type Warning =
  | { kind: "noRate"; email: string; client: string; project: string }
  // Priced per task, where each task's price stands for a level, so nobody has a rate of their own.
  | { kind: "noRatePricedByTask"; email: string; client: string; project: string }
  | { kind: "ratesNotRising"; email: string; project: string; rates: number[]; kept: number }
  | { kind: "severalOrganizations"; email: string; organizations: string[]; placedIn: string }
  | { kind: "sharedName"; client: string; name: string; projects: string[] }
  | { kind: "nonBillableEntries"; project: string; entries: number }
  | { kind: "mixedRatedEntries"; email: string; project: string; task: string; day: string };

// Problems stop the import; warnings don't.
export type Findings = { problems: string[]; warnings: Warning[] };

// Exports without time entries plan today's state; with them, history too.
export function planImport(harvestExports: HarvestExport[], organizations: KnownOrganization[]) {
  const findings: Findings = { problems: [], warnings: [] };
  const slugByAccount = matchOrganizations(harvestExports, organizations, findings);
  const { people, emailByHarvestUser } = mergePeople(harvestExports, slugByAccount);
  const { clients, projectsByCode, codeByHarvestProject } = planProjects(
    harvestExports,
    slugByAccount,
    findings,
  );
  const assignments = readAssignments(
    harvestExports,
    codeByHarvestProject,
    slugByAccount,
    findings,
  );
  const entries = readEntries(
    harvestExports,
    emailByHarvestUser,
    codeByHarvestProject,
    slugByAccount,
    findings,
  );
  const { users, organizationByEmail } = placeUsers(people, assignments, entries, findings);

  // People assigned to or logging on another organization's project take part through their own.
  for (const { code, email } of [...entries, ...assignments]) {
    const project = projectsByCode.get(code) as ImportPlan["projects"][number];
    const organization = organizationByEmail.get(email) as string;
    if (!project.organizations.includes(organization)) project.organizations.push(organization);
  }

  const plan: ImportPlan = {
    users,
    clients,
    projects: [...projectsByCode.values()],
    tasks: [],
    assignments: planAssignments(assignments, projectsByCode, people, findings),
    entries: [],
  };
  plan.entries = planEntries(entries, plan.projects, people, findings);
  nameProjectsApart(plan.projects, findings);

  // Tasks people may log time on now, and those they logged time on.
  const taskKeys = new Set([
    ...harvestExports.flatMap(({ account, taskAssignments }) =>
      taskAssignments.flatMap((task) => {
        const code = codeByHarvestProject.get(`${account.id}:${task.project.id}`);
        return code ? [`${code}|${task.task.name}`] : [];
      }),
    ),
    ...plan.entries.map((entry) => `${entry.project}|${entry.task}`),
  ]);
  plan.tasks = [...taskKeys].map((key) => {
    const [project, name] = key.split("|") as [string, string];
    return { project, name };
  });

  // Merged Harvest projects can report the same problem once per part.
  return {
    plan,
    problems: [...new Set(findings.problems)],
    warnings: [
      ...new Map(findings.warnings.map((warning) => [JSON.stringify(warning), warning])).values(),
    ],
  };
}

// What the command-line import writes, since no one is there to pick.
export const suggestedOwners = (plan: ImportPlan) =>
  new Map(
    plan.projects.flatMap((project) =>
      project.suggestedOwner ? [[project.code, project.suggestedOwner] as const] : [],
    ),
  );
