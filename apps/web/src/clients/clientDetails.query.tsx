import { projects } from "@tid/db/schema";
import { DataGrid, Page, Section, SidebarLayout, SummaryList } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import type { ProjectSummary } from "../projects/projectSummary";
import { listProjects } from "../projects/projectSummary.data";
import type { Client } from "./client";
import { findClient, listAccountManagers } from "./client.data";
import { enterOrganizationNumberUrl } from "./clients.url";
import { formatOrganizationNumber } from "./organizationNumber";

export const clientDetails = async (c: Context<UserEnv>) => {
  const client = await findClient(c.req.param("id"));
  if (!client) return c.notFound();
  const clientProjects = await listProjects(eq(projects.clientId, client.id));
  return c.render(
    <ClientDetailsPage
      client={client}
      accountManagers={await listAccountManagers(client.id)}
      projects={clientProjects}
      canChange={c.get("user").isManager}
    />,
  );
};

function ClientDetailsPage({
  client,
  accountManagers,
  projects,
  canChange,
}: {
  client: Client;
  accountManagers: { name: string }[];
  projects: ProjectSummary[];
  /** Only managers change clients and start projects. */
  canChange: boolean;
}) {
  const organizations = [...new Set(projects.flatMap((project) => project.organizations))].sort();
  return (
    <Page
      title={client.name}
      back={{ href: "/clients", label: "Back to clients" }}
      actions={[
        canChange && {
          label: "New project",
          href: `/projects/new?client=${client.id}`,
          [attributes.layer]: true,
        },
      ]}
    >
      <SidebarLayout
        sidebar={
          <Section title="Projects">
            {projects.length === 0 ? (
              <p class="ink-subtle">No projects yet.</p>
            ) : (
              <DataGrid columns={[{ label: "Name" }]}>
                {projects.map((project) => (
                  <DataGrid.Row href={`/projects/${project.id}`}>
                    <DataGrid.Title secondary={project.code}>{project.name}</DataGrid.Title>
                  </DataGrid.Row>
                ))}
              </DataGrid>
            )}
          </Section>
        }
      >
        <SummaryList
          rows={[
            {
              label: "Name",
              values: [client.name],
              action: canChange && {
                label: "Edit",
                href: `/clients/${client.id}/edit`,
                "aria-label": "Edit name",
                [attributes.layer]: true,
              },
            },
            {
              label: "Organization number",
              values: [
                client.organizationNumber
                  ? formatOrganizationNumber(client.organizationNumber)
                  : "None",
              ],
              action: canChange && {
                label: client.organizationNumber ? "Edit" : "Add",
                href: enterOrganizationNumberUrl.path({ clientId: client.id }),
                "aria-label": client.organizationNumber
                  ? "Edit organization number"
                  : "Add organization number",
                [attributes.layer]: true,
              },
            },
            !!client.legalName && { label: "Legal name", values: [client.legalName] },
            !!client.registeredAddress?.length && {
              label: "Registered address",
              values: client.registeredAddress,
            },
            {
              label: "Account managers",
              values: accountManagers.length
                ? accountManagers.map((person) => person.name)
                : ["None"],
              action: canChange && {
                label: "Edit",
                href: `/clients/${client.id}/account-managers`,
                "aria-label": "Edit account managers",
                [attributes.layer]: true,
              },
            },
            {
              label: "Organizations",
              values: organizations.length ? organizations : ["None"],
            },
            { label: "Projects", values: [String(projects.length)] },
          ]}
        />
      </SidebarLayout>
    </Page>
  );
}
