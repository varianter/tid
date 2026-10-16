import { clients, projects, tasks, timeEntries } from "@tid/db/schema";
import { Button, DataGrid, EmptyState, Page } from "@tid/ui";
import { countDistinct, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { formatSpent } from "../projects/projectSummary";
import type { Client } from "./client";

export const clientList = async (c: Context) => {
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
  return c.render(<ClientListPage clients={rows} />);
};

type ClientRow = Client & { projectCount: number; spentMinutes: number };

const newClientButton = () => (
  <Button as="a" href="/clients/new" data-variant="tinted">
    New client
  </Button>
);

function ClientListPage({ clients }: { clients: ClientRow[] }) {
  return (
    <Page title="Clients" actions={newClientButton()}>
      {clients.length === 0 ? (
        <EmptyState emoji="🏢" title="No clients yet" action={newClientButton()} />
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
              {formatSpent(client.spentMinutes)}
            </DataGrid.Row>
          ))}
        </DataGrid>
      )}
    </Page>
  );
}
