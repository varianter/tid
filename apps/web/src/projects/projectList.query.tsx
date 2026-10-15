import { projectOrganizations, projects } from "@tid/db/schema";
import { Button, EmptyState, Page } from "@tid/ui";
import { and, eq, exists } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { findOrganizationSlug } from "../organizations/organization";
import {
  listOrganizations,
  type OrganizationOption,
  OrganizationSelect,
} from "../organizations/organizationSelect";
import { isManager } from "../users/manager";
import { listProjects, type ProjectSummary, ProjectTable } from "./projectSummary";

const projectListPath = (organizationSlug: string) =>
  `/projects?${new URLSearchParams({ organization: organizationSlug })}`;

export const projectList = async (c: Context<UserEnv>) => {
  const slug = c.req.query("organization");
  if (!slug) {
    const ownSlug = await findOrganizationSlug(c.get("user").orgId);
    if (!ownSlug) return c.notFound();
    return c.redirect(projectListPath(ownSlug));
  }
  const organizationOptions = await listOrganizations();
  const organization = organizationOptions.find((option) => option.slug === slug);
  if (!organization) return c.notFound();

  const participates = exists(
    database
      .select()
      .from(projectOrganizations)
      .where(
        and(
          eq(projectOrganizations.projectId, projects.id),
          eq(projectOrganizations.orgId, organization.id),
        ),
      ),
  );
  return c.render(
    <ProjectListPage
      projects={await listProjects(participates)}
      organizationSlug={slug}
      organizations={organizationOptions}
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
  organizationSlug,
  organizations,
  canStartProjects,
}: {
  projects: ProjectSummary[];
  organizationSlug: string;
  organizations: OrganizationOption[];
  canStartProjects: boolean;
}) {
  return (
    <Page
      title="Projects"
      actions={
        <>
          <OrganizationSelect organizationSlug={organizationSlug} organizations={organizations} />
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
