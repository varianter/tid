import { clients as clientsTable } from "@tid/db/schema";
import { Hono } from "hono";
import { database } from "../database";
import { formAction } from "../form/formAction";
import { newClientForm } from "./clients.validation";
import { ClientPage, ClientsPage } from "./clients.views";

export const clients = new Hono();

// ponytail: smoke test for the database, replace with the real clients page.
clients.on(
  ["GET", "POST"],
  "/",
  formAction({
    schema: newClientForm,
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
    view: ClientsPage,
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

  return c.render(<ClientPage client={client} projects={projects} />);
});
