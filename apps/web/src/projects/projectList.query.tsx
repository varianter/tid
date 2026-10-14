import { Button, EmptyState, Page } from "@tid/ui";
import type { Context } from "hono";
import { listProjects, type ProjectSummary, ProjectTable } from "./projectSummary";

export const projectList = async (c: Context) =>
  c.render(<ProjectListPage projects={await listProjects()} />);

const newProjectButton = () => (
  <Button as="a" href="/projects/new" data-variant="tinted">
    New project
  </Button>
);

function ProjectListPage({ projects }: { projects: ProjectSummary[] }) {
  return (
    <Page title="Projects" actions={newProjectButton()}>
      {projects.length === 0 ? (
        <EmptyState emoji="📁" title="No projects yet" action={newProjectButton()} />
      ) : (
        <ProjectTable projects={projects} />
      )}
    </Page>
  );
}
