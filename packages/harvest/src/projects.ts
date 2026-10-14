import type { HarvestExport } from "./harvestExport";
import type { Findings, ImportPlan } from "./plan";

// Non-billable projects of this client are internal, so everyone may log time on them.
const internalClientName = "Varianttid";
// Leave that reporting keeps out of billable base hours. Harvest has no such setting.
const notCountingTowardBillableBase = new Set(["FER1000", "VEL1000"]);
// The reporting database holds project codes of at most 16 characters.
const maxCodeLength = 16;

// Projects are identified by code, across accounts too, and clients by name ignoring case.
export function planProjects(
  harvestExports: HarvestExport[],
  slugByAccount: Map<number, string>,
  { problems, warnings }: Findings,
) {
  // Keeps the first spelling.
  const clientNames = new Map<string, string>();
  const clientName = (name: string) => {
    const key = name.toLowerCase();
    if (!clientNames.has(key)) clientNames.set(key, name);
    return clientNames.get(key) as string;
  };

  // AAA9999-S is the same project as AAA9999, since the suffix isn't applied consistently.
  const codeByHarvestProject = new Map<string, string>();
  const harvestProjects = harvestExports.flatMap(({ account, projects }) =>
    projects.map((project) => ({ account, project })),
  );
  for (const { account, project } of harvestProjects) {
    const code = project.code?.trim().replace(/-S$/i, "");
    if (!code) {
      problems.push(`${account.name}: project "${project.name}" has no code.`);
      continue;
    }
    if (code.length > maxCodeLength) {
      problems.push(
        `${account.name}: project code ${code} is longer than ${maxCodeLength} characters.`,
      );
    }
    if (project.starts_on && project.ends_on && project.ends_on < project.starts_on) {
      problems.push(`${account.name}: project ${code} ends before it starts.`);
    }
    codeByHarvestProject.set(`${account.id}:${project.id}`, code);
  }

  const projectsByCode = new Map<string, ImportPlan["projects"][number]>();
  const fixedFeeCodes = new Set<string>();
  for (const [code, sameCode] of Map.groupBy(
    harvestProjects.filter(({ account, project }) =>
      codeByHarvestProject.has(`${account.id}:${project.id}`),
    ),
    ({ account, project }) => codeByHarvestProject.get(`${account.id}:${project.id}`) as string,
  )) {
    const [{ project: first }] = sameCode as [(typeof sameCode)[number]];
    const describe = () =>
      sameCode.map(({ account, project }) => `"${project.name}" in ${account.name}`).join(", ");
    const clients = new Set(sameCode.map(({ project }) => project.client.name.toLowerCase()));
    if (clients.size > 1) {
      problems.push(`Project code ${code} is used for different clients: ${describe()}.`);
    }
    if (sameCode.some(({ project }) => project.is_billable !== first.is_billable)) {
      problems.push(
        `Project code ${code} is billable on some projects but not others: ${describe()}.`,
      );
    }
    if (sameCode.some(({ project }) => project.is_fixed_fee)) {
      fixedFeeCodes.add(code);
      warnings.push({ kind: "fixedFee", project: code });
    }
    const startDates = sameCode.map(({ project }) => project.starts_on);
    const endDates = sameCode.map(({ project }) => project.ends_on);
    const client = clientName(first.client.name);
    projectsByCode.set(code, {
      code,
      client,
      name: [...new Set(sameCode.map(({ project }) => project.name))].join(" / "),
      billable: first.is_billable,
      openToEveryone:
        !first.is_billable && client.toLowerCase() === internalClientName.toLowerCase(),
      countsTowardBillableBase: !notCountingTowardBillableBase.has(code),
      // A merged project spans all of its parts, and is open-ended if any part is.
      startsOn: startDates.includes(null) ? null : (startDates.toSorted()[0] ?? null),
      endsOn: endDates.includes(null) ? null : (endDates.toSorted().at(-1) ?? null),
      organizations: [
        ...new Set(sameCode.map(({ account }) => slugByAccount.get(account.id) as string)),
      ],
    });
  }

  return {
    clients: [...clientNames.values()],
    projectsByCode,
    codeByHarvestProject,
    fixedFeeCodes,
  };
}

// A client's project names must be unique, but Harvest allows one name under several codes.
export function nameProjectsApart(projects: ImportPlan["projects"], { warnings }: Findings) {
  const projectsByName = Map.groupBy(projects, (project) => `${project.client}|${project.name}`);
  for (const sameName of [...projectsByName.values()].filter((projects) => projects.length > 1)) {
    const [{ client, name }] = sameName as [ImportPlan["projects"][number]];
    const codes = sameName.map((project) => project.code);
    warnings.push({ kind: "sharedName", client, name, projects: codes });
    for (const project of sameName) project.name = `${name} (${project.code})`;
  }
}
