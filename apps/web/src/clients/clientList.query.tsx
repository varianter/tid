import { clients, projects } from "@tid/db/schema";
import { type Action, Actions, DataGrid, EmptyState, Icon, Page } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import { countDistinct, eq } from "drizzle-orm";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import type { Client } from "./client";

export const clientList = async (c: Context<UserEnv>) => {
  const rows = await database
    .select({
      id: clients.id,
      name: clients.name,
      organizationNumber: clients.organizationNumber,
      projectCount: countDistinct(projects.id),
    })
    .from(clients)
    .leftJoin(projects, eq(projects.clientId, clients.id))
    .groupBy(clients.id)
    .orderBy(clients.name);
  return c.render(<ClientListPage clients={rows} canAddClients={c.get("user").isManager} />);
};

type ClientRow = Pick<Client, "id" | "name" | "organizationNumber"> & { projectCount: number };

const newClient: Action = { label: "New client", href: "/clients/new", [attributes.layer]: true };

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
          title="No clients yet"
          action={canAddClients && <Actions actions={[newClient]} />}
        />
      ) : (
        <DataGrid
          columns={[
            { label: "Name" },
            { label: "Org. number", kind: "fit" },
            { label: "Projects", kind: "number" },
          ]}
        >
          {clients.map((client) => (
            <DataGrid.Row href={`/clients/${client.id}`}>
              <DataGrid.Title>{client.name}</DataGrid.Title>
              {client.organizationNumber ? (
                <Icon name="check" class="fs-xs" label="Has an organization number" />
              ) : (
                ""
              )}
              {client.projectCount}
            </DataGrid.Row>
          ))}
        </DataGrid>
      )}
    </Page>
  );
}
