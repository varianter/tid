import type { HarvestExport } from "./harvestExport";
import type { Billing, Findings, ImportPlan } from "./plan";

// Non-billable projects of this client are internal, so everyone may log time on them.
const internalClientName = "Varianttid";
// Leave that reporting keeps out of billable base hours. Harvest has no such setting.
const notCountingTowardBillableBase = new Set(["FER1000", "VEL1000"]);
// The reporting database holds project codes of at most 16 characters.
const maxCodeLength = 16;
// Marks the account that has subcontractors on the project, which makes it the contract owner.
const subcontractorsSuffix = /-S$/i;

const billingOf = (project: HarvestExport["projects"][number]): Billing =>
  !project.is_billable ? "non_billable" : project.is_fixed_fee ? "fixed_fee" : "hourly";

// The organization that invoices the client, when the Harvest projects make it clear: the only
// account the project is in, or the only one whose code says it has subcontractors.
function suggestOwner(parts: ImportPlan["projects"][number]["harvestProjects"]) {
  const only = (organizations: string[]) => {
    const distinct = new Set(organizations);
    return distinct.size === 1 ? ([...distinct][0] as string) : null;
  };
  return (
    only(parts.map((part) => part.organization)) ??
    only(
      parts.filter((part) => subcontractorsSuffix.test(part.code)).map((part) => part.organization),
    )
  );
}

// Projects are identified by code, across accounts too, and clients by name ignoring case.
export function planProjects(
  harvestExports: HarvestExport[],
  slugByAccount: Map<number, string>,
  { problems }: Findings,
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
    const code = project.code?.trim().replace(subcontractorsSuffix, "");
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
    const billing = billingOf(first);
    if (sameCode.some(({ project }) => billingOf(project) !== billing)) {
      problems.push(`Project code ${code} is billed differently on its projects: ${describe()}.`);
    }
    const harvestProjects = sameCode.flatMap(({ account, project }) => {
      const organization = slugByAccount.get(account.id);
      return organization ? [{ organization, code: (project.code as string).trim() }] : [];
    });
    const startDates = sameCode.map(({ project }) => project.starts_on);
    const endDates = sameCode.map(({ project }) => project.ends_on);
    const client = clientName(first.client.name);
    projectsByCode.set(code, {
      code,
      client,
      name: [...new Set(sameCode.map(({ project }) => project.name))].join(" / "),
      billing,
      openToEveryone:
        billing === "non_billable" && client.toLowerCase() === internalClientName.toLowerCase(),
      countsTowardBillableBase: !notCountingTowardBillableBase.has(code),
      // A merged project spans all of its parts, and is open-ended if any part is.
      startsOn: startDates.includes(null) ? null : (startDates.toSorted()[0] ?? null),
      endsOn: endDates.includes(null) ? null : (endDates.toSorted().at(-1) ?? null),
      organizations: [
        ...new Set(sameCode.map(({ account }) => slugByAccount.get(account.id) as string)),
      ],
      harvestProjects,
      suggestedOwner: billing === "non_billable" ? null : suggestOwner(harvestProjects),
    });
  }

  return {
    clients: [...clientNames.values()],
    projectsByCode,
    codeByHarvestProject,
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
