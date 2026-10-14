import { clients, projects, tasks, timeEntries } from "@tid/db/schema";
import { Button, EmptyState, Page } from "@tid/ui";
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
        <div
          class="d-grid of-scroll gap-column-l lh-snug t-tabular"
          style="grid-template-columns: minmax(16ch, 1fr) max-content max-content;"
        >
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
            <span>Name</span>
            <span class="ta-right">Projects</span>
            <span class="ta-right">Spent</span>
          </div>
          {clients.map((client) => (
            <a
              href={`/clients/${client.id}`}
              class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s"
            >
              <span class="fw-medium">{client.name}</span>
              <span class="ta-right">{client.projectCount}</span>
              <span class="ta-right">{formatSpent(client.spentMinutes)}</span>
            </a>
          ))}
        </div>
      )}
    </Page>
  );
}
