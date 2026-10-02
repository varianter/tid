import { clients as clientsTable } from "@tid/db/schema";
import { Button, Input, Label, Page } from "@tid/ui";
import { Hono } from "hono";
import { z } from "zod";
import { database } from "../database";
import { formAction } from "../form/formAction";

export const clients = new Hono();

// ponytail: smoke test for the database, replace with the real clients page.
clients.on(
  ["GET", "POST"],
  "/",
  formAction({
    schema: z.object({ name: z.string().trim().min(1) }),
    loader: async () => ({
      clients: await database.select().from(clientsTable).orderBy(clientsTable.name),
    }),
    onSubmit: async (_c, { name }) => {
      const inserted = await database
        .insert(clientsTable)
        .values({ name })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) return { fieldErrors: { name: ["Already exists"] } };
      return { redirect: "/clients" };
    },
    view: ({ clients, values, fieldErrors }) => (
      <Page
        title="Clients"
        actions={
          <Button type="button" data-variant="tinted">
            New client
          </Button>
        }
      >
        <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
          {clients.map((client) => (
            <li class="surface-tinted">
              <a href={`/clients/${client.id}`} class="d-block p-xs px-m">
                {client.name}
              </a>
            </li>
          ))}
        </ul>
        <form method="post" class="w-max-5">
          <div class="stack-v">
            <Label for="name">Client name</Label>
            <Input
              id="name"
              name="name"
              value={values?.name}
              aria-invalid={fieldErrors?.name ? "true" : undefined}
              required
            />
            {fieldErrors?.name && (
              <color-mode palette="coral" class="d-block ink-default mt-3xs">
                {fieldErrors.name[0]}
              </color-mode>
            )}
          </div>

          <Button class="mt-s" type="submit">
            Add client
          </Button>
        </form>
      </Page>
    ),
  }),
);

clients.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const client = await database.query.clients.findFirst({
    where: (client, { eq }) => eq(client.id, id),
  });
  if (!client) return c.notFound();
  const projects = await database.query.projects.findMany({
    where: (project, { eq }) => eq(project.clientId, id),
    orderBy: (project, { asc }) => asc(project.name),
  });

  return c.render(
    <Page
      title={client.name}
      back={{ href: "/clients", label: "Back to clients" }}
      actions={
        <Button as="a" href={`/projects/new?client=${id}`} data-variant="tinted">
          New project
        </Button>
      }
    >
      {projects.length === 0 ? (
        <p class="ink-subtle">No projects yet.</p>
      ) : (
        <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
          {projects.map((project) => (
            <li class="p-xs px-m surface-tinted">
              {project.name} <span class="ink-subtle">{project.code}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>,
  );
});
