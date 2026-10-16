import { expect, test } from "bun:test";
import type { ImportPlan } from "@tid/harvest/plan";
import { groupPreview } from "./importPreview";

const project = (code: string, client: string) => ({
  code,
  client,
  name: `Project ${code}`,
  billing: "hourly" as const,
  openToEveryone: false,
  countsTowardBillableBase: true,
  startsOn: null,
  endsOn: null,
  organizations: ["trondheim"],
  harvestProjects: [{ organization: "trondheim", code }],
  suggestedOwner: "trondheim",
});

const plan: ImportPlan = {
  users: [
    {
      email: "kari@example.com",
      name: "Kari",
      organization: "trondheim",
      manager: false,
      harvestRoles: [],
    },
    {
      email: "ola@example.com",
      name: "Ola",
      organization: "oslo",
      manager: true,
      harvestRoles: [],
    },
  ],
  clients: ["Kunde AS", "Ny Kunde AS"],
  projects: [
    project("KUN1001", "Kunde AS"),
    project("KUN1002", "Kunde AS"),
    project("NYK1000", "Ny Kunde AS"),
  ],
  tasks: [
    { project: "KUN1001", name: "Utvikling" },
    { project: "KUN1001", name: "Nivå 2" },
    { project: "KUN1002", name: "Utvikling" },
  ],
  assignments: [
    {
      project: "KUN1001",
      email: "ola@example.com",
      rates: [{ validFrom: "2026-07-01", rate: 160000 }],
    },
    { project: "NYK1000", email: "kari@example.com", rates: [] },
  ],
  entries: [],
};

const nothingAdded = {
  users: [],
  clients: [],
  projects: [],
  participations: [],
  tasks: [],
  assignments: [],
  rates: [],
  entries: [],
};

test("shows new rows under their client and project, leaving out what Tid already has", () => {
  const { users, clients } = groupPreview(
    plan,
    {
      ...nothingAdded,
      users: ["ola@example.com"],
      clients: ["Ny Kunde AS"],
      projects: ["NYK1000"],
      tasks: ["KUN1001 Nivå 2"],
      assignments: ["KUN1001 ola@example.com", "NYK1000 kari@example.com"],
      rates: ["KUN1001 ola@example.com"],
    },
    new Map([["oslo", "NOK"]]),
  );

  expect(users.map(([organization, rows]) => [organization, rows.map((row) => row.email)])).toEqual(
    [["oslo", ["ola@example.com"]]],
  );
  // KUN1002 has nothing new, so it's left out.
  expect(clients.map((client) => [client.name, client.projects.map((p) => p.code)])).toEqual([
    ["Kunde AS", ["KUN1001"]],
    ["Ny Kunde AS", ["NYK1000"]],
  ]);
  const existing = clients[0]?.projects[0];
  expect(existing?.tasks.filter((task) => task.isNew).map((task) => task.name)).toEqual(["Nivå 2"]);
  expect(existing?.people).toEqual([
    {
      name: "Ola",
      email: "ola@example.com",
      isNew: true,
      rate: { validFrom: "2026-07-01", rate: 160000, currency: "NOK", isNew: true },
    },
  ]);
});
