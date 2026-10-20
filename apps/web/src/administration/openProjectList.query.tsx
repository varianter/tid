import { clients, projectOrganizations, projects } from "@tid/db/schema";
import { DataGrid, EmptyState, Page } from "@tid/ui";
import { and, eq, notExists } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug } from "../organizations/organization";
import { participation } from "../projects/projectParticipation";
import { administrationPath } from "./administrationUrl";
import { CloseProjectToMembersForm } from "./closeProjectToMembers.command";
import { OpenProjectToMembersForm } from "./openProjectToMembers.command";

const projectRow = {
  id: projects.id,
  name: projects.name,
  code: projects.code,
  client: clients.name,
};

export const openProjectList = async (c: Context<UserEnv>) => {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  if (!organization) return c.notFound();

  const openProjects = await database
    .select(projectRow)
    .from(projectOrganizations)
    .innerJoin(projects, eq(projects.id, projectOrganizations.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projectOrganizations.orgId, organization.id), projectOrganizations.openToMembers))
    .orderBy(clients.name, projects.name);

  const openableProjects = await database
    .select(projectRow)
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        eq(projects.billing, "non_billable"),
        notExists(
          database
            .select()
            .from(projectOrganizations)
            .where(
              and(participation(projects.id, organization.id), projectOrganizations.openToMembers),
            ),
        ),
      ),
    )
    .orderBy(clients.name, projects.name);

  return c.render(
    <OpenProjectListPage
      organization={organization}
      openProjects={openProjects}
      openableProjects={openableProjects}
    />,
  );
};

type ProjectRow = { id: number; name: string; code: string; client: string };

function OpenProjectListPage({
  organization,
  openProjects,
  openableProjects,
}: {
  organization: { slug: string; name: string };
  openProjects: ProjectRow[];
  openableProjects: ProjectRow[];
}) {
  return (
    <Page
      title={`Projects open to everyone in ${organization.name}`}
      back={{ href: administrationPath(organization.slug), label: "Administration" }}
      actions={
        <OpenProjectToMembersForm
          organizationSlug={organization.slug}
          projects={openableProjects}
        />
      }
    >
      {openProjects.length === 0 ? (
        <EmptyState emoji="🔓" title="No open projects">
          Members log time only on projects they're assigned to.
        </EmptyState>
      ) : (
        <DataGrid
          columns={[
            { label: "Client" },
            { label: "Project" },
            { label: "Code", kind: "fit" },
            { kind: "action" },
          ]}
        >
          {openProjects.map((project) => (
            <DataGrid.Row>
              {project.client}
              <a href={`/projects/${project.id}`} class="fw-medium">
                {project.name}
              </a>
              <span class="ink-subtle">{project.code}</span>
              <CloseProjectToMembersForm
                organizationSlug={organization.slug}
                projectId={project.id}
              />
            </DataGrid.Row>
          ))}
        </DataGrid>
      )}
    </Page>
  );
}
