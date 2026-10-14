import type { ImportPlan } from "@tid/harvest/plan";
import type { writePlan } from "@tid/harvest/write";

type Added = Awaited<ReturnType<typeof writePlan>>["added"];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "nb");

// What an import would add, shaped the way people look for it: users by organization, and
// projects under their client with their tasks and people. Rows that are already in Tid are left
// out, unless something new sits under them.
export function groupPreview(plan: ImportPlan, added: Added, currencies: Map<string, string>) {
  const isNew = (kind: keyof Added, key: string) => added[kind].includes(key);
  const users = new Map(plan.users.map((user) => [user.email, user]));

  const projects = plan.projects.map((project) => {
    const tasks = plan.tasks
      .filter((task) => task.project === project.code)
      .map((task) => ({ name: task.name, isNew: isNew("tasks", `${task.project} ${task.name}`) }));
    const people = plan.assignments
      .filter((assignment) => assignment.project === project.code)
      .map((assignment) => {
        const key = `${assignment.project} ${assignment.email}`;
        const user = users.get(assignment.email);
        const [rate] = assignment.rates;
        return {
          name: user?.name ?? assignment.email,
          email: assignment.email,
          isNew: isNew("assignments", key),
          rate: rate && {
            ...rate,
            currency: currencies.get(user?.organization ?? "") ?? "",
            isNew: isNew("rates", key),
          },
        };
      })
      .toSorted(byName);
    const organizations = project.organizations.map((slug) => ({
      slug,
      isNew: isNew("participations", `${project.code} ${slug}`),
    }));
    const hasNews =
      isNew("projects", project.code) ||
      [...tasks, ...people, ...organizations].some((row) => row.isNew) ||
      people.some((person) => person.rate?.isNew);
    return {
      ...project,
      isNew: isNew("projects", project.code),
      hasNews,
      tasks,
      people,
      organizations,
    };
  });

  const clients = plan.clients
    .map((name) => ({
      name,
      isNew: isNew("clients", name),
      projects: projects
        .filter((project) => project.client === name && project.hasNews)
        .toSorted((a, b) => a.code.localeCompare(b.code)),
    }))
    .filter((client) => client.isNew || client.projects.length > 0)
    .toSorted(byName);

  const newUsers = Map.groupBy(
    plan.users.filter((user) => isNew("users", user.email)).toSorted(byName),
    (user) => user.organization,
  );
  return { users: [...newUsers], clients };
}
