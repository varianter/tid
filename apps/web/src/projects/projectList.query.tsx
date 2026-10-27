import { projectOrganizations, projects } from "@tid/db/schema";
import { type Action, Actions, EmptyState, Page } from "@tid/ui";
import { and, eq, exists, inArray } from "drizzle-orm";
import type { Context } from "hono";
import {
  type OrganizationFilter,
  OrganizationSelect,
  resolveOrganizationFilter,
} from "../domain/organizations/organizationFilter";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { Filtered } from "../framework/filter";
import { type ProjectSummary, ProjectTable } from "./projectSummary";
import { listProjects } from "./projectSummary.data";

export const projectList = async (c: Context<UserEnv>) => {
  const organizationFilter = await resolveOrganizationFilter(c);
  if (organizationFilter instanceof Response) return organizationFilter;

  const participates = exists(
    database
      .select()
      .from(projectOrganizations)
      .where(
        and(
          eq(projectOrganizations.projectId, projects.id),
          inArray(
            projectOrganizations.orgId,
            organizationFilter.selected.organizations.map((organization) => organization.id),
          ),
        ),
      ),
  );
  return c.render(
    <ProjectListPage
      projects={await listProjects(participates)}
      {...organizationFilter}
      canStartProjects={c.get("user").isManager}
    />,
  );
};

const newProject: Action = { label: "New project", href: "/projects/new" };

function ProjectListPage({
  projects,
  selected,
  options,
  canStartProjects,
}: { projects: ProjectSummary[]; canStartProjects: boolean } & OrganizationFilter) {
  return (
    <Page title="Projects" actions={[canStartProjects && newProject]}>
      <Filtered by={<OrganizationSelect selected={selected} options={options} />}>
        {projects.length === 0 ? (
          <EmptyState
            emoji="📁"
            title="No projects yet"
            action={canStartProjects && <Actions actions={[newProject]} />}
          />
        ) : (
          <ProjectTable projects={projects} />
        )}
      </Filtered>
    </Page>
  );
}
