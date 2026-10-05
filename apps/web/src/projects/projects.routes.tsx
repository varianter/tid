import {
  clients,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects as projectsTable,
  tasks,
  timeEntries,
  users,
} from "@tid/db/schema";
import { and, eq, ne, notExists, type SQL, sql } from "drizzle-orm";
import { Hono } from "hono";
import { inProjectOrganization } from "../assignments/assignments.routes";
import { database } from "../database";
import { formAction } from "../form/formAction";
import type { User } from "../login/user";
import { suggestProjectCode } from "./projectCode";
import { editProjectForm, newProjectForm } from "./projects.validation";
import { ProjectFormPage, ProjectPage, ProjectsPage } from "./projects.views";

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

const projectDetails = {
  id: projectsTable.id,
  name: projectsTable.name,
  code: projectsTable.code,
  billable: projectsTable.billable,
  clientId: clients.id,
  client: clients.name,
  spentMinutes,
  organizations: participatingOrganizations,
};

// Every project, or a client's with `where`, sorted by client so they group.
export const listProjects = (where?: SQL) =>
  database
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      code: projectsTable.code,
      clientId: clients.id,
      client: clients.name,
      spentMinutes,
      organizations: participatingOrganizations,
    })
    .from(projectsTable)
    .innerJoin(clients, eq(clients.id, projectsTable.clientId))
    .where(where)
    .orderBy(clients.name, projectsTable.name);

projects.get("/", async (c) => c.render(<ProjectsPage projects={await listProjects()} />));

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
    view: ProjectFormPage,
  }),
);

projects.on(
  ["GET", "POST"],
  "/:id/edit",
  formAction({
    schema: editProjectForm,
    loader: async (c) => {
      const id = Number(c.req.param("id"));
      if (!Number.isSafeInteger(id)) return c.notFound();
      const [project] = await database
        .select({
          ...projectDetails,
          openToEveryone: projectsTable.openToEveryone,
          countsTowardBillableBase: projectsTable.countsTowardBillableBase,
        })
        .from(projectsTable)
        .innerJoin(clients, eq(clients.id, projectsTable.clientId))
        .where(eq(projectsTable.id, id));
      return project ? { project } : c.notFound();
    },
    onSubmit: async (_c, form, { project }) => {
      if (form.billable && project.openToEveryone) {
        return { formError: "Projects open to everyone can't be billable" };
      }
      try {
        await database.update(projectsTable).set(form).where(eq(projectsTable.id, project.id));
      } catch {
        // ponytail: assumes a unique violation; any other failure reads as a name clash.
        const codeTaken = await database.$count(
          projectsTable,
          and(eq(projectsTable.code, form.code), ne(projectsTable.id, project.id)),
        );
        return codeTaken
          ? { fieldErrors: { code: ["Already in use"] } }
          : { fieldErrors: { name: ["The client already has a project with this name"] } };
      }
      return { redirect: `/projects/${project.id}` };
    },
    view: ProjectFormPage,
  }),
);

projects.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const [project] = await database
    .select(projectDetails)
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

  const assignedPeople = await database
    .select({ id: users.id, name: users.name })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .where(eq(projectAssignments.projectId, id))
    .orderBy(users.name);

  const assignablePeople = await database
    .select({ id: users.id, name: users.name })
    .from(users)
    .innerJoin(projectOrganizations, inProjectOrganization(id))
    .where(
      notExists(
        database
          .select()
          .from(projectAssignments)
          .where(
            and(eq(projectAssignments.projectId, id), eq(projectAssignments.userId, users.id)),
          ),
      ),
    )
    .orderBy(users.name);

  return c.render(
    <ProjectPage
      project={project}
      tasks={projectTasks}
      assignedPeople={assignedPeople}
      assignablePeople={assignablePeople}
    />,
  );
});
