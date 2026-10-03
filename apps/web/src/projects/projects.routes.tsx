import {
  clients,
  organizations,
  projectOrganizations,
  projects as projectsTable,
  tasks,
  timeEntries,
} from "@tid/db/schema";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { database } from "../database";
import { formAction } from "../form/formAction";
import type { User } from "../login/user";
import { suggestProjectCode } from "./projectCode";
import { newProjectForm } from "./projects.validation";
import { NewProjectPage, ProjectPage, ProjectsPage } from "./projects.views";

export const projects = new Hono();

const spentMinutes = sql<number>`(
  select coalesce(sum(${timeEntries.minutes}), 0)
  from ${timeEntries} join ${tasks} on ${tasks.id} = ${timeEntries.taskId}
  where ${tasks.projectId} = ${projectsTable.id}
)`.mapWith(Number);

// The owner comes first, so it reads as the lead organization.
const participatingOrganizations = sql<string[]>`(
  select coalesce(array_agg(${organizations.name} order by ${projectOrganizations.isOwner} desc, ${organizations.name}), '{}')
  from ${projectOrganizations} join ${organizations} on ${organizations.id} = ${projectOrganizations.orgId}
  where ${projectOrganizations.projectId} = ${projectsTable.id}
)`;

projects.get("/", async (c) => {
  const rows = await database
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      code: projectsTable.code,
      client: clients.name,
      spentMinutes,
      organizations: participatingOrganizations,
    })
    .from(projectsTable)
    .innerJoin(clients, eq(clients.id, projectsTable.clientId))
    .orderBy(clients.name, projectsTable.name);

  return c.render(<ProjectsPage projects={rows} />);
});

projects.on(
  ["GET", "POST"],
  "/new",
  formAction({
    schema: newProjectForm,
    loader: async (c) => {
      const codes = await database
        .select({ clientId: projectsTable.clientId, code: projectsTable.code })
        .from(projectsTable);
      const allCodes = codes.map((row) => row.code);
      const clientRows = await database.select().from(clients).orderBy(clients.name);
      return {
        clients: clientRows.map((client) => ({
          ...client,
          codeSuggestion: suggestProjectCode(
            client.name,
            codes.filter((row) => row.clientId === client.id).map((row) => row.code),
            allCodes,
          ),
        })),
        suggestedClientId: c.req.query("client"),
      };
    },
    onSubmit: async (c, project, { clients }) => {
      if (!clients.some((client) => client.id === project.clientId)) {
        return { fieldErrors: { clientId: ["Pick a client"] } };
      }
      const user: User | undefined = c.get("user");
      const [inserted] = await database.transaction(async (transaction) => {
        const rows = await transaction
          .insert(projectsTable)
          .values(project)
          .onConflictDoNothing()
          .returning();
        if (rows[0] && user) {
          await transaction
            .insert(projectOrganizations)
            .values({ projectId: rows[0].id, orgId: user.orgId, isOwner: true });
        }
        return rows;
      });
      if (inserted) return { redirect: `/projects/${inserted.id}` };

      const codeTaken = await database.$count(projectsTable, eq(projectsTable.code, project.code));
      return codeTaken
        ? { fieldErrors: { code: ["Already in use"] } }
        : { fieldErrors: { name: ["The client already has a project with this name"] } };
    },
    view: NewProjectPage,
  }),
);

projects.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const [project] = await database
    .select({
      name: projectsTable.name,
      code: projectsTable.code,
      billable: projectsTable.billable,
      clientId: clients.id,
      client: clients.name,
      spentMinutes,
      organizations: participatingOrganizations,
    })
    .from(projectsTable)
    .innerJoin(clients, eq(clients.id, projectsTable.clientId))
    .where(eq(projectsTable.id, id));
  if (!project) return c.notFound();

  const projectTasks = await database
    .select({
      name: tasks.name,
      spentMinutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
    })
    .from(tasks)
    .leftJoin(timeEntries, eq(timeEntries.taskId, tasks.id))
    .where(eq(tasks.projectId, id))
    .groupBy(tasks.id)
    .orderBy(tasks.name);

  return c.render(<ProjectPage project={project} tasks={projectTasks} />);
});
