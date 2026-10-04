// Maps Harvest exports onto our tables, following docs/decisions-for-import-rules.md.
// Nothing here touches the database, so every problem is found before anything is written.

export type HarvestExport = {
  account: { id: number; name: string };
  users: { id: number; first_name: string; last_name: string; email: string }[];
  projects: {
    id: number;
    code: string | null;
    name: string;
    is_billable: boolean;
    starts_on: string | null;
    ends_on: string | null;
    client: { name: string };
  }[];
  timeEntries: {
    spent_date: string;
    hours: number;
    notes: string | null;
    billable: boolean;
    billable_rate: number | null;
    user: { id: number };
    client: { currency: string };
    project: { id: number };
    task: { name: string };
  }[];
};

// The organizations in the database, which Harvest accounts are matched to by name.
export type KnownOrganization = { slug: string; name: string; currency: string };

// Rows refer to each other by email, client name, project code and organization slug; the
// writer resolves ids.
export type ImportPlan = {
  users: { email: string; name: string; organization: string }[];
  clients: string[];
  projects: {
    code: string;
    client: string;
    name: string;
    billable: boolean;
    openToEveryone: boolean;
    countsTowardBillableBase: boolean;
    startsOn: string | null;
    endsOn: string | null;
    organizations: string[];
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

// Non-billable projects of this client are internal, so everyone may log time on them.
const internalClientName = "Varianttid";
// Leave that reporting keeps out of billable base hours. Harvest has no such setting.
const notCountingTowardBillableBase = new Set(["FER1000", "VEL1000"]);
// The reporting database holds project codes of at most 16 characters.
const maxCodeLength = 16;

function groupBy<Item>(items: Item[], key: (item: Item) => string) {
  const groups = new Map<string, Item[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

export function planImport(harvestExports: HarvestExport[], organizations: KnownOrganization[]) {
  const problems: string[] = [];
  const warnings: string[] = [];
  const plan: ImportPlan = {
    users: [],
    clients: [],
    projects: [],
    tasks: [],
    assignments: [],
    entries: [],
  };

  const slugByAccount = new Map<number, string>();
  for (const { account, timeEntries } of harvestExports) {
    const organization = organizations.find((known) => known.name === account.name);
    if (!organization) {
      problems.push(`${account.name}: no organization has this name; add it in a migration.`);
      continue;
    }
    const currencies = new Set(timeEntries.map((entry) => entry.client.currency));
    currencies.delete(organization.currency);
    if (currencies.size > 0) {
      problems.push(
        `${account.name}: logs time in ${[...currencies].join(", ")}, but the organization uses ${organization.currency}.`,
      );
    }
    slugByAccount.set(account.id, organization.slug);
  }

  // One person is one user across accounts, matched by email ignoring case.
  const people = new Map<
    string,
    { email: string; name: string; minutesBySlug: Map<string, number> }
  >();
  const emailByHarvestUser = new Map<string, string>();
  for (const { account, users } of harvestExports) {
    for (const user of users) {
      const key = user.email.toLowerCase();
      if (!people.has(key)) {
        people.set(key, {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          minutesBySlug: new Map(),
        });
      }
      emailByHarvestUser.set(`${account.id}:${user.id}`, key);
    }
  }

  // Clients are matched by name ignoring case, keeping the first spelling.
  const clientNames = new Map<string, string>();
  const clientName = (name: string) => {
    const key = name.toLowerCase();
    if (!clientNames.has(key)) clientNames.set(key, name);
    return clientNames.get(key) as string;
  };

  // Projects are identified by code, across accounts too. AAA9999-S is the same project as
  // AAA9999, since the suffix isn't applied consistently.
  const codeByHarvestProject = new Map<string, string>();
  const harvestProjects = harvestExports.flatMap(({ account, projects }) =>
    projects.map((project) => ({ account, project })),
  );
  const projectsByCode = new Map<string, ImportPlan["projects"][number]>();
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
  for (const [code, sameCode] of groupBy(
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

  const entries = harvestExports.flatMap(({ account, timeEntries }) =>
    timeEntries.flatMap((entry) => {
      const email = emailByHarvestUser.get(`${account.id}:${entry.user.id}`);
      const code = codeByHarvestProject.get(`${account.id}:${entry.project.id}`);
      if (!email) {
        problems.push(`${account.name}: an entry on ${entry.spent_date} has an unknown user.`);
        return [];
      }
      // Its project was reported above, so its entries don't need reporting one by one.
      if (!code) return [];
      const slug = slugByAccount.get(account.id) as string;
      const person = people.get(email);
      person?.minutesBySlug.set(slug, (person.minutesBySlug.get(slug) ?? 0) + entry.hours * 60);
      return [{ ...entry, account, email, code }];
    }),
  );

  // Harvest can't tell which organization a person belongs to, so it's where they log the most.
  const organizationByEmail = new Map<string, string>();
  for (const [key, person] of people) {
    const bySlug = [...person.minutesBySlug].toSorted((a, b) => b[1] - a[1]);
    const [chosen] = bySlug;
    if (!chosen) continue;
    organizationByEmail.set(key, chosen[0]);
    if (bySlug.length > 1) {
      warnings.push(
        `${person.email} logs time in ${bySlug.map(([slug]) => slug).join(" and ")}; ` +
          `placed in ${chosen[0]}, where they log the most.`,
      );
    }
    plan.users.push({ email: person.email, name: person.name, organization: chosen[0] });
  }

  for (const [key, sameAssignment] of groupBy(entries, (entry) => `${entry.code}|${entry.email}`)) {
    const { code, email, account } = sameAssignment[0] as (typeof entries)[number];
    const project = projectsByCode.get(code) as ImportPlan["projects"][number];
    const organization = organizationByEmail.get(email) as string;
    if (!project.organizations.includes(organization)) project.organizations.push(organization);
    if (project.openToEveryone) continue;

    // Harvest stamps the rate on each entry, so a new rate starts on the first day it's seen.
    const ratesByDay = groupBy(
      sameAssignment.filter((entry) => entry.billable_rate !== null),
      (entry) => entry.spent_date,
    );
    const rates: { validFrom: string; rate: number }[] = [];
    for (const [day, dayEntries] of [...ratesByDay].toSorted(([a], [b]) => a.localeCompare(b))) {
      const dayRates = [...new Set(dayEntries.map((entry) => entry.billable_rate as number))];
      if (dayRates.length > 1) {
        problems.push(
          `${account.name}: ${people.get(email)?.email} has several rates on project ${code} on ${day} ` +
            `(${dayRates.join(", ")}), probably one per task. Split the project into one per rate.`,
        );
        continue;
      }
      const rate = Math.round((dayRates[0] as number) * 100);
      if (rates.at(-1)?.rate !== rate) rates.push({ validFrom: day, rate });
    }
    plan.assignments.push({ project: code, email: people.get(email)?.email ?? key, rates });
  }

  for (const project of projectsByCode.values()) {
    const projectEntries = entries.filter((entry) => entry.code === project.code);
    if (project.billable && projectEntries.every((entry) => entry.billable_rate === null)) {
      warnings.push(
        `Project ${project.code} is billable without rates, probably fixed fee; it exports without an amount.`,
      );
    }
    const nonBillable = projectEntries.filter((entry) => !entry.billable);
    if (project.billable && nonBillable.length > 0) {
      warnings.push(
        `Project ${project.code} has ${nonBillable.length} non-billable entries, which export as billable.`,
      );
    }
    plan.projects.push(project);
  }

  // A client's project names must be unique, but Harvest allows one name under several codes.
  const projectsByName = groupBy(plan.projects, (project) => `${project.client}|${project.name}`);
  for (const sameName of [...projectsByName.values()].filter((projects) => projects.length > 1)) {
    const [{ client, name }] = sameName as [ImportPlan["projects"][number]];
    const codes = sameName.map((project) => project.code);
    warnings.push(
      `${client} has several projects named "${name}" (${codes.join(", ")}); each gets its code added to the name.`,
    );
    for (const project of sameName) project.name = `${name} (${project.code})`;
  }

  // One entry per user, task and day: Harvest's entries are summed and their notes joined.
  for (const sameDay of groupBy(
    entries,
    (entry) => `${entry.email}|${entry.code}|${entry.task.name}|${entry.spent_date}`,
  ).values()) {
    const first = sameDay[0] as (typeof entries)[number];
    const minutes = Math.round(sameDay.reduce((total, entry) => total + entry.hours, 0) * 60);
    if (minutes > 24 * 60) {
      problems.push(
        `${first.account.name}: ${people.get(first.email)?.email} logged more than 24 hours on ` +
          `${first.code} / ${first.task.name} on ${first.spent_date}.`,
      );
    }
    const notes = sameDay.flatMap((entry) => (entry.notes?.trim() ? [entry.notes.trim()] : []));
    const rated = sameDay.filter((entry) => entry.billable_rate !== null);
    const prices = [
      ...new Set(rated.map((entry) => `${entry.billable_rate} ${entry.client.currency}`)),
    ];
    const describeDay = () =>
      `${people.get(first.email)?.email} on ${first.code} / ${first.task.name} on ${first.spent_date}`;
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
    plan.entries.push({
      email: people.get(first.email)?.email ?? first.email,
      project: first.code,
      task: first.task.name,
      spentOn: first.spent_date,
      minutes,
      notes: notes.length > 0 ? notes.join("\n") : null,
      rate: price ? Math.round((price.billable_rate as number) * 100) : null,
      currency: price ? price.client.currency : null,
    });
  }
  const taskKeys = new Set(plan.entries.map((entry) => `${entry.project}|${entry.task}`));
  plan.tasks = [...taskKeys].map((key) => {
    const [project, name] = key.split("|") as [string, string];
    return { project, name };
  });
  plan.clients = [...clientNames.values()];

  return { plan, problems, warnings };
}
