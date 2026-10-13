// Maps Harvest exports onto our tables, following the rules in README.md.
// Nothing here touches the database, so every problem is found before anything is written.

export type HarvestExport = {
  account: { id: number; name: string };
  users: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_active: boolean;
    access_roles: string[];
    default_hourly_rate: number | null;
  }[];
  projects: {
    id: number;
    code: string | null;
    name: string;
    is_active: boolean;
    is_billable: boolean;
    is_fixed_fee: boolean;
    // Where the rate comes from: the project, each task or each person.
    bill_by: "Project" | "Tasks" | "People" | "none";
    hourly_rate: number | null;
    starts_on: string | null;
    ends_on: string | null;
    client: { name: string; currency: string };
  }[];
  // Only active assignments, which say who may log time where today.
  userAssignments: {
    project: { id: number };
    user: { id: number };
    use_default_rates: boolean;
    hourly_rate: number | null;
    created_at: string;
  }[];
  taskAssignments: {
    project: { id: number };
    task: { name: string };
    billable: boolean;
    hourly_rate: number | null;
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
  for (const { account, projects } of harvestExports) {
    const organization = organizations.find((known) => known.name === account.name);
    if (!organization) {
      problems.push(`${account.name}: no organization has this name; add it in a migration.`);
      continue;
    }
    const currencies = new Set(projects.map((project) => project.client.currency));
    currencies.delete(organization.currency);
    if (currencies.size > 0) {
      problems.push(
        `${account.name}: has clients in ${[...currencies].join(", ")}, but the organization uses ${organization.currency}.`,
      );
    }
    slugByAccount.set(account.id, organization.slug);
  }

  // One person is one user across accounts, matched by email ignoring case.
  const people = new Map<
    string,
    {
      email: string;
      name: string;
      harvestRoles: Set<string>;
      workBySlug: Map<string, { assignments: number; minutes: number }>;
    }
  >();
  const emailByHarvestUser = new Map<string, string>();
  const workIn = (email: string, slug: string) => {
    const workBySlug = people.get(email)?.workBySlug ?? new Map();
    if (!workBySlug.has(slug)) workBySlug.set(slug, { assignments: 0, minutes: 0 });
    return workBySlug.get(slug) as { assignments: number; minutes: number };
  };
  for (const { account, users } of harvestExports) {
    const slug = slugByAccount.get(account.id);
    for (const user of users) {
      const key = user.email.toLowerCase();
      const person = people.get(key) ?? {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        harvestRoles: new Set<string>(),
        workBySlug: new Map(),
      };
      people.set(key, person);
      for (const role of user.access_roles) person.harvestRoles.add(role);
      if (slug) workIn(key, slug);
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
  const fixedFeeCodes = new Set<string>();
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
    if (sameCode.some(({ project }) => project.is_fixed_fee)) {
      fixedFeeCodes.add(code);
      warnings.push(`Project ${code} is fixed fee, so its hours export without an amount.`);
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

  // The rate a project charges everyone on it, when it doesn't charge each person their own.
  const projectRates = new Map<string, number | null>();
  // Projects that price their tasks differently, where a task stands for a level or a year's price.
  const pricedByTask = new Set<string>();
  for (const { account, projects, taskAssignments } of harvestExports) {
    for (const project of projects) {
      const key = `${account.id}:${project.id}`;
      const code = codeByHarvestProject.get(key);
      if (!code) continue;
      if (project.bill_by === "Project") projectRates.set(key, project.hourly_rate);
      if (project.bill_by !== "Tasks") continue;
      const taskRates = [
        ...new Set(
          taskAssignments
            .filter((task) => task.project.id === project.id && task.billable)
            .flatMap((task) => (task.hourly_rate === null ? [] : [task.hourly_rate])),
        ),
      ];
      if (taskRates.length > 1) pricedByTask.add(key);
      else projectRates.set(key, taskRates[0] ?? null);
    }
  }

  // Harvest only knows today's rate, so it's valid from when the person was assigned.
  const assigned = harvestExports.flatMap(
    ({ account, projects, users, userAssignments, timeEntries }) =>
      userAssignments.flatMap((assignment) => {
        const key = `${account.id}:${assignment.project.id}`;
        const code = codeByHarvestProject.get(key);
        const project = projects.find((candidate) => candidate.id === assignment.project.id);
        const user = users.find((candidate) => candidate.id === assignment.user.id);
        // Nobody logs time on archived projects or as a deactivated user.
        if (!code || !project?.is_active || !user?.is_active) return [];
        const email = user.email.toLowerCase();
        const slug = slugByAccount.get(account.id);
        if (slug) workIn(email, slug).assignments++;
        const since = assignment.created_at.slice(0, 10);
        if (project.bill_by === "People") {
          const rate = assignment.use_default_rates
            ? user.default_hourly_rate
            : assignment.hourly_rate;
          return [{ email, code, rate, since }];
        }
        if (!pricedByTask.has(key))
          return [{ email, code, rate: projectRates.get(key) ?? null, since }];

        // A person's task is their level or the year's price, so they keep the rate they were last
        // billed at. Someone who hasn't logged time yet gets theirs set by hand.
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
          warnings.push(
            `${user.email} was billed at ${billedRates.join(", ")} on project ${code}, not as a price ` +
              `increase; they keep the last, ${rate}.`,
          );
        }
        return [{ email, code, rate, since }];
      }),
  );

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
      workIn(email, slugByAccount.get(account.id) as string).minutes += entry.hours * 60;
      return [{ ...entry, account, email, code }];
    }),
  );

  // Harvest can't tell which organization a person belongs to, so it's where they work the
  // most: assigned to the most projects, then logging the most time.
  const organizationByEmail = new Map<string, string>();
  for (const [key, person] of people) {
    const bySlug = [...person.workBySlug].toSorted(
      ([, a], [, b]) => b.assignments - a.assignments || b.minutes - a.minutes,
    );
    const [chosen] = bySlug;
    if (!chosen) continue;
    organizationByEmail.set(key, chosen[0]);
    if (bySlug.length > 1) {
      warnings.push(
        `${person.email} is in ${bySlug.map(([slug]) => slug).join(" and ")}; ` +
          `placed in ${chosen[0]}, where they work the most.`,
      );
    }
    plan.users.push({
      email: person.email,
      name: person.name,
      organization: chosen[0],
      // Anyone with more than a member's access in some Harvest account manages in Tid, where
      // the role spans organizations.
      manager: [...person.harvestRoles].some((role) => role !== "member"),
      harvestRoles: [...person.harvestRoles],
    });
  }

  // People assigned to or logging on another organization's project take part through their own.
  const takePart = (code: string, email: string) => {
    const project = projectsByCode.get(code) as ImportPlan["projects"][number];
    const organization = organizationByEmail.get(email) as string;
    if (!project.organizations.includes(organization)) project.organizations.push(organization);
    return project;
  };
  for (const entry of entries) takePart(entry.code, entry.email);

  for (const sameAssignment of groupBy(
    assigned,
    (entry) => `${entry.code}|${entry.email}`,
  ).values()) {
    const { code, email } = sameAssignment[0] as (typeof assigned)[number];
    const project = takePart(code, email);
    if (project.openToEveryone) continue;
    const person = people.get(email) as { email: string };
    const rates = [
      ...new Set(sameAssignment.flatMap((entry) => (entry.rate === null ? [] : [entry.rate]))),
    ];
    if (rates.length > 1) {
      problems.push(
        `${person.email} has different rates on project ${code} in different accounts (${rates.join(", ")}).`,
      );
    }
    const [rate] = rates;
    if (rate === undefined && project.billable && !fixedFeeCodes.has(code)) {
      warnings.push(
        `${person.email} has no rate on project ${code}, so their hours export without an amount.`,
      );
    }
    const validFrom = sameAssignment.map((entry) => entry.since).toSorted()[0] as string;
    plan.assignments.push({
      project: code,
      email: person.email,
      rates: rate === undefined ? [] : [{ validFrom, rate: Math.round(rate * 100) }],
    });
  }

  for (const project of projectsByCode.values()) {
    const nonBillable = entries.filter((entry) => entry.code === project.code && !entry.billable);
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
  plan.clients = [...clientNames.values()];

  // Merged Harvest projects can report the same problem once per part.
  return { plan, problems: [...new Set(problems)], warnings: [...new Set(warnings)] };
}
