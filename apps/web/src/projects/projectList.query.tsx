import { projectOrganizations, projects } from "@tid/db/schema";
import { type Action, Actions, EmptyState, Page } from "@tid/ui";
import { and, eq, exists, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { type CompanyFilter, CompanySelect, resolveCompany } from "../organizations/companyFilter";
import { Filtered } from "../query/filter";
import { listProjects, type ProjectSummary, ProjectTable } from "./projectSummary";

export const projectList = async (c: Context<UserEnv>) => {
  const company = await resolveCompany(c);
  if (company instanceof Response) return company;

  const participates = exists(
    database
      .select()
      .from(projectOrganizations)
      .where(
        and(
          eq(projectOrganizations.projectId, projects.id),
          inArray(
            projectOrganizations.orgId,
            company.selected.organizations.map((organization) => organization.id),
          ),
        ),
      ),
  );
  return c.render(
    <ProjectListPage
      projects={await listProjects(participates)}
      {...company}
      canStartProjects={c.get("user").isManager}
    />,
  );
};

const newProject: Action = { label: "New project", href: "/projects/new" };

function ProjectListPage({
  projects,
  selected,
  companies,
  canStartProjects,
}: { projects: ProjectSummary[]; canStartProjects: boolean } & CompanyFilter) {
  return (
    <Page title="Projects" actions={[canStartProjects && newProject]}>
      <Filtered by={<CompanySelect selected={selected} companies={companies} />}>
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
