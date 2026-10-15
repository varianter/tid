import { clients, projectOrganizations, projects } from "@tid/db/schema";
import { EmptyState, Page } from "@tid/ui";
import { and, eq, not, notExists } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { participation } from "../projects/projectParticipation";
import { managesOrganization } from "../users/manager";
import { CloseProjectToMembersForm } from "./closeProjectToMembers.command";
import { OpenProjectToMembersForm } from "./openProjectToMembers.command";
import { findOrganizationBySlug } from "./organization";

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

  const canChange = await managesOrganization(c.get("user"), organization.id);
  const openableProjects = canChange
    ? await database
        .select(projectRow)
        .from(projects)
        .innerJoin(clients, eq(clients.id, projects.clientId))
        .where(
          and(
            not(projects.billable),
            notExists(
              database
                .select()
                .from(projectOrganizations)
                .where(
                  and(
                    participation(projects.id, organization.id),
                    projectOrganizations.openToMembers,
                  ),
                ),
            ),
          ),
        )
        .orderBy(clients.name, projects.name)
    : [];

  return c.render(
    <OpenProjectListPage
      organization={organization}
      openProjects={openProjects}
      openableProjects={openableProjects}
      canChange={canChange}
    />,
  );
};

type ProjectRow = { id: number; name: string; code: string; client: string };

function OpenProjectListPage({
  organization,
  openProjects,
  openableProjects,
  canChange,
}: {
  organization: { slug: string; name: string };
  openProjects: ProjectRow[];
  openableProjects: ProjectRow[];
  canChange: boolean;
}) {
  return (
    <Page
      title={`Projects open to everyone in ${organization.name}`}
      back={{
        href: `/projects?${new URLSearchParams({ organization: organization.slug })}`,
        label: "Projects",
      }}
      actions={
        canChange && (
          <OpenProjectToMembersForm
            organizationSlug={organization.slug}
            projects={openableProjects}
          />
        )
      }
    >
      {openProjects.length === 0 ? (
        <EmptyState emoji="🔓" title="No open projects">
          Members log time only on projects they're assigned to.
        </EmptyState>
      ) : (
        <div
          class="d-grid of-scroll gap-column-l lh-snug"
          style={`grid-template-columns: minmax(12ch, 1fr) minmax(16ch, 1fr) max-content${canChange ? " max-content" : ""};`}
        >
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
            <span>Client</span>
            <span>Project</span>
            <span>Code</span>
            {canChange && <span />}
          </div>
          {openProjects.map((project) => (
            <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s">
              <span>{project.client}</span>
              <a href={`/projects/${project.id}`} class="fw-medium">
                {project.name}
              </a>
              <span class="ink-subtle">{project.code}</span>
              {canChange && (
                <span class="justify-self-end">
                  <CloseProjectToMembersForm
                    organizationSlug={organization.slug}
                    projectId={project.id}
                  />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
