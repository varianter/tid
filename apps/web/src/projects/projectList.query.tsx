import { projectOrganizations, projects } from "@tid/db/schema";
import { Button, EmptyState, Page } from "@tid/ui";
import { and, eq, exists, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { type Company, CompanySelect, resolveCompany } from "../organizations/companyFilter";
import { isManager } from "../users/manager";
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
      canStartProjects={await isManager(c.get("user"))}
    />,
  );
};

const newProjectButton = () => (
  <Button as="a" href="/projects/new" data-variant="tinted">
    New project
  </Button>
);

function ProjectListPage({
  projects,
  selected,
  companies,
  canStartProjects,
}: {
  projects: ProjectSummary[];
  selected: Company;
  companies: Company[];
  canStartProjects: boolean;
}) {
  return (
    <Page
      title="Projects"
      actions={
        <>
          <CompanySelect selected={selected} companies={companies} />
          {canStartProjects && newProjectButton()}
        </>
      }
    >
      {projects.length === 0 ? (
        <EmptyState
          emoji="📁"
          title="No projects yet"
          action={canStartProjects && newProjectButton()}
        />
      ) : (
        <ProjectTable projects={projects} />
      )}
    </Page>
  );
}
