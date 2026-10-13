// Lays out an import plan as tables, so a person can check what Harvest becomes before it's written.

import { styleText } from "node:util";
import type { ImportPlan } from "./plan";

type Cell = string | number;

const longestText = 32;
const shorten = (text: string) =>
  text.length > longestText ? `${text.slice(0, longestText - 1)}…` : text;

function table(title: string, headers: string[], rows: Cell[][]) {
  const texts = rows.map((row) => row.map(String));
  const widths = headers.map((header, column) =>
    Math.max(Bun.stringWidth(header), ...texts.map((row) => Bun.stringWidth(row[column] ?? ""))),
  );
  // Columns of numbers are right-aligned, so their digits line up.
  const numeric = headers.map((_, column) =>
    texts.every((row) => /^[\d.]*$/.test(row[column] ?? "")),
  );
  const line = (cells: string[]) =>
    `  ${cells
      .map((cell, column) => {
        const padding = " ".repeat((widths[column] as number) - Bun.stringWidth(cell));
        return numeric[column] ? padding + cell : cell + padding;
      })
      .join("  ")
      .trimEnd()}`;
  return [
    styleText("bold", `${title} (${rows.length})`),
    styleText("dim", line(headers)),
    ...texts.map(line),
  ].join("\n");
}

const byText = (a: string, b: string) => a.localeCompare(b, "nb");

// Harvest lists a manager's permissions as roles too; the access level is what decides.
const accessLevels = ["administrator", "manager", "project_manager", "member"];
const accessLevel = (roles: string[]) =>
  accessLevels.find((level) => roles.includes(level)) ?? roles.join(", ");

export function describePlan(plan: ImportPlan) {
  const organizationByEmail = new Map(
    plan.users.map((user) => [user.email.toLowerCase(), user.organization]),
  );
  const count = <Item>(items: Item[], matches: (item: Item) => boolean) =>
    items.filter(matches).length;

  const users = table(
    "Users",
    ["Name", "Email", "Organization", "Harvest access", "Tid role"],
    plan.users
      .toSorted((a, b) => byText(a.organization, b.organization) || byText(a.name, b.name))
      .map((user) => [
        user.name,
        user.email,
        user.organization,
        accessLevel(user.harvestRoles),
        user.manager ? "manager" : "",
      ]),
  );

  const clients = table(
    "Clients",
    ["Client", "Projects"],
    plan.clients
      .toSorted(byText)
      .map((client) => [client, count(plan.projects, (project) => project.client === client)]),
  );

  const projects = table(
    "Projects",
    ["Code", "Name", "Client", "Billing", "Billable base", "Organizations", "Tasks", "People"],
    plan.projects
      .toSorted((a, b) => byText(a.code, b.code))
      .map((project) => [
        project.code,
        shorten(project.name),
        shorten(project.client),
        project.openToEveryone ? "open to all" : project.billable ? "billable" : "non-billable",
        project.countsTowardBillableBase ? "" : "left out",
        project.organizations.join(", "),
        count(plan.tasks, (task) => task.project === project.code),
        count(plan.assignments, (assignment) => assignment.project === project.code),
      ]),
  );

  const assignments = table(
    "Assignments",
    ["Project", "Person", "Rate", "From"],
    plan.assignments
      .toSorted((a, b) => byText(a.project, b.project) || byText(a.email, b.email))
      .map((assignment) => {
        const [rate] = assignment.rates;
        return [
          assignment.project,
          assignment.email,
          rate ? rate.rate / 100 : "",
          rate ? rate.validFrom : "",
        ];
      }),
  );

  // Totals per month and organization, to compare with Harvest's own reports.
  const entryTotals = new Map<
    string,
    { month: string; organization: string; entries: number; minutes: number }
  >();
  for (const entry of plan.entries) {
    const month = entry.spentOn.slice(0, 7);
    const organization = organizationByEmail.get(entry.email.toLowerCase()) ?? "";
    const key = `${month}|${organization}`;
    const total = entryTotals.get(key) ?? { month, organization, entries: 0, minutes: 0 };
    total.entries++;
    total.minutes += entry.minutes;
    entryTotals.set(key, total);
  }
  const entries = table(
    "Time entries by month",
    ["Month", "Organization", "Entries", "Hours"],
    [...entryTotals.values()]
      .toSorted((a, b) => byText(a.month, b.month) || byText(a.organization, b.organization))
      .map(({ month, organization, entries, minutes }) => [
        month,
        organization,
        entries,
        (minutes / 60).toFixed(2),
      ]),
  );

  return [users, clients, projects, assignments, entries].join("\n\n");
}
