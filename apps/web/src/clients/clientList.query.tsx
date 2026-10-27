import { clients, projects, tasks, timeEntries } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { type Action, Actions, DataGrid, EmptyState, Page } from "@tid/ui";
import { countDistinct, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import type { Client } from "./client";

export const clientList = async (c: Context<UserEnv>) => {
  const rows = await database
    .select({
      id: clients.id,
      name: clients.name,
      projectCount: countDistinct(projects.id),
      spentMinutes: sql`coalesce(sum(${timeEntries.minutes}), 0)`.mapWith(Number),
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .leftJoin(timeEntries, eq(timeEntries.taskId, tasks.id))
    .groupBy(clients.id)
    .orderBy(clients.name);
  return c.render(<ClientListPage clients={rows} canAddClients={c.get("user").isManager} />);
};

type ClientRow = Client & { projectCount: number; spentMinutes: number };

const newClient: Action = { label: "New client", href: "/clients/new" };

function ClientListPage({
  clients,
  canAddClients,
}: {
  clients: ClientRow[];
  canAddClients: boolean;
}) {
  return (
    <Page title="Clients" actions={[canAddClients && newClient]}>
      {clients.length === 0 ? (
        <EmptyState
          emoji="🏢"
          title="No clients yet"
          action={canAddClients && <Actions actions={[newClient]} />}
        />
      ) : (
        <DataGrid
          columns={[
            { label: "Name" },
            { label: "Projects", kind: "number" },
            { label: "Spent", kind: "number" },
          ]}
        >
          {clients.map((client) => (
            <DataGrid.Row href={`/clients/${client.id}`}>
              <DataGrid.Title>{client.name}</DataGrid.Title>
              {client.projectCount}
              {formatTotalHours(client.spentMinutes)}
            </DataGrid.Row>
          ))}
        </DataGrid>
      )}
    </Page>
  );
}
