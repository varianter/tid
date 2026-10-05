import { clients as clientsTable, projects, tasks, timeEntries } from "@tid/db/schema";
import { and, countDistinct, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { listProjects } from "../projects/projects.routes";
import { clientForm } from "./clients.validation";
import { ClientFormPage, ClientPage, ClientsPage } from "./clients.views";

export const clients = new Hono();

const alreadyExists = { fieldErrors: { name: ["Already exists"] } };

clients.get("/", async (c) => {
  const rows = await database
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      projectCount: countDistinct(projects.id),
      spentMinutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
    })
    .from(clientsTable)
    .leftJoin(projects, eq(projects.clientId, clientsTable.id))
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .leftJoin(timeEntries, eq(timeEntries.taskId, tasks.id))
    .groupBy(clientsTable.id)
    .orderBy(clientsTable.name);
  return c.render(<ClientsPage clients={rows} />);
});

clients.on(
  ["GET", "POST"],
  "/new",
  formAction({
    schema: clientForm,
    loader: async () => ({}),
    onSubmit: async (_c, { name }) => {
      const [inserted] = await database
        .insert(clientsTable)
        .values({ name })
        .onConflictDoNothing()
        .returning();
      return inserted ? { redirect: `/clients/${inserted.id}` } : alreadyExists;
    },
    view: ClientFormPage,
  }),
);

const findClient = async (idParam: string | undefined) => {
  const id = Number(idParam);
  if (!Number.isSafeInteger(id)) return undefined;
  const [client] = await database.select().from(clientsTable).where(eq(clientsTable.id, id));
  return client;
};

clients.on(
  ["GET", "POST"],
  "/:id/edit",
  formAction({
    schema: clientForm,
    loader: async (c) => {
      const client = await findClient(c.req.param("id"));
      return client ? { client } : c.notFound();
    },
    onSubmit: async (_c, { name }, { client }) => {
      const nameTaken = await database.$count(
        clientsTable,
        and(eq(clientsTable.name, name), ne(clientsTable.id, client.id)),
      );
      if (nameTaken) return alreadyExists;
      await database.update(clientsTable).set({ name }).where(eq(clientsTable.id, client.id));
      return { redirect: `/clients/${client.id}` };
    },
    view: ClientFormPage,
  }),
);

clients.get("/:id", async (c) => {
  const client = await findClient(c.req.param("id"));
  if (!client) return c.notFound();
  const clientProjects = await listProjects(eq(projects.clientId, client.id));
  return c.render(<ClientPage client={client} projects={clientProjects} />);
});
