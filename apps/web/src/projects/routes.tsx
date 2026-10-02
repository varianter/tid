import {
  clients,
  organizations,
  projectOrganizations,
  projects as projectsTable,
  tasks,
  timeEntries,
} from "@tid/db/schema";
import { Button, Checkbox, EmptyState, Input, Label, Page, Select } from "@tid/ui";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { PropsWithChildren } from "hono/jsx";
import { z } from "zod";
import type { User } from "../auth/devLogin";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { formatHours } from "../timesheet/dates";
import { suggestProjectCode } from "./projectCode";

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

const newProjectButton = () => (
  <Button as="a" href="/projects/new" data-variant="tinted">
    New project
  </Button>
);

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

  return c.render(
    <Page title="Projects" actions={newProjectButton()}>
      {rows.length === 0 ? (
        <EmptyState emoji="📁" title="No projects yet" action={newProjectButton()} />
      ) : (
        <div
          class="d-grid of-scroll gap-column-l lh-snug t-tabular"
          style="grid-template-columns: minmax(16ch, 1fr) minmax(12ch, 1fr) minmax(12ch, 1fr) max-content;"
        >
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
            <span>Name</span>
            <span>Client</span>
            <span>Organizations</span>
            <span class="ta-right">Spent</span>
          </div>
          {rows.map((project) => (
            <a
              href={`/projects/${project.id}`}
              class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s"
            >
              <span class="stack-v gap-4xs">
                <span class="fw-medium">{project.name}</span>
                <span class="fs-xs ink-subtle">{project.code}</span>
              </span>
              <span>{project.client}</span>
              <span>{project.organizations.join(", ")}</span>
              <span class="ta-right">{formatSpent(project.spentMinutes)}</span>
            </a>
          ))}
        </div>
      )}
    </Page>,
  );
});

projects.on(
  ["GET", "POST"],
  "/new",
  formAction({
    schema: z.object({
      clientId: z.coerce.number().int(),
      name: z.string().trim().min(1),
      // The reporting database holds at most 16 characters.
      code: z.string().trim().min(1).max(16),
      billable: z
        .literal("on")
        .optional()
        .transform((value) => value === "on"),
    }),
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
    view: ({ clients, suggestedClientId, values, fieldErrors }) => {
      const selectedClientId = values?.clientId ?? suggestedClientId;
      // ponytail: follows the client selected on load only; updating on change needs client-side JS.
      const codeSuggestion = clients.find(
        (client) => String(client.id) === selectedClientId,
      )?.codeSuggestion;
      return (
        <Page title="New project" back={{ href: "/projects", label: "Back to projects" }}>
          <form method="post" class="stack-v gap-m w-max-5">
            <Field id="clientId" label="Client" errors={fieldErrors?.clientId}>
              <Select
                id="clientId"
                name="clientId"
                required
                aria-invalid={fieldErrors?.clientId ? "true" : undefined}
              >
                <option value="">Choose a client</option>
                {clients.map((client) => (
                  <option value={client.id} selected={String(client.id) === selectedClientId}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="name" label="Name" errors={fieldErrors?.name}>
              <Input
                id="name"
                name="name"
                value={values?.name}
                required
                aria-invalid={fieldErrors?.name ? "true" : undefined}
              />
            </Field>
            <Field id="code" label="Code" errors={fieldErrors?.code}>
              <Input
                id="code"
                name="code"
                value={values?.code}
                maxlength={16}
                required
                aria-invalid={fieldErrors?.code ? "true" : undefined}
              />
              {codeSuggestion && <p class="fs-s ink-subtle mt-3xs">Suggestion: {codeSuggestion}</p>}
            </Field>
            <Label class="stack-h items-center gap-xs">
              <Checkbox name="billable" checked={values ? values.billable === "on" : true} />
              Billable
            </Label>
            <Button type="submit" class="w-max-content">
              Create project
            </Button>
          </form>
        </Page>
      );
    },
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

  return c.render(
    <Page title={project.name} back={{ href: "/projects", label: "Back to projects" }}>
      <dl class="stack-h items-start gap-xl b-all bc-default br-l p-m">
        <Detail label="Client">
          <a href={`/clients/${project.clientId}`}>{project.client}</a>
        </Detail>
        <Detail label="Code">{project.code}</Detail>
        <Detail label="Billable">{project.billable ? "Yes" : "No"}</Detail>
        <Detail label="Organizations">{project.organizations.join(", ") || "None"}</Detail>
        <Detail label="Spent">{formatSpent(project.spentMinutes)}</Detail>
      </dl>
      {projectTasks.length === 0 ? (
        <p class="ink-subtle">No tasks yet.</p>
      ) : (
        <ul class="stack-v gap-3xs b-all bc-subtle p-2xs t-tabular">
          {projectTasks.map((task) => (
            <li class="stack-h justify-between p-xs px-m surface-tinted">
              {task.name}
              <span class="ink-subtle">{formatSpent(task.spentMinutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>,
  );
});

function formatSpent(minutes: number) {
  return `${formatHours(minutes) || "0"} h`;
}

function Field({
  id,
  label,
  errors,
  children,
}: PropsWithChildren<{ id: string; label: string; errors?: string[] }>) {
  return (
    <div class="stack-v">
      <Label for={id}>{label}</Label>
      {children}
      {errors && (
        <color-mode palette="coral" class="d-block ink-default mt-3xs">
          {errors[0]}
        </color-mode>
      )}
    </div>
  );
}

function Detail({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div class="stack-v gap-3xs">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="fw-medium">{children}</dd>
    </div>
  );
}
