import { projects } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { Button, Detail, Page } from "@tid/ui";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { listProjects, type ProjectSummary, ProjectTable } from "../projects/projectSummary";
import { type Client, findClient } from "./client";

export const clientDetails = async (c: Context) => {
  const client = await findClient(c.req.param("id"));
  if (!client) return c.notFound();
  const clientProjects = await listProjects(eq(projects.clientId, client.id));
  return c.render(<ClientDetailsPage client={client} projects={clientProjects} />);
};

function ClientDetailsPage({ client, projects }: { client: Client; projects: ProjectSummary[] }) {
  const spentMinutes = projects.reduce((total, project) => total + project.spentMinutes, 0);
  const organizations = [...new Set(projects.flatMap((project) => project.organizations))].sort();
  return (
    <Page
      title={client.name}
      back={{ href: "/clients", label: "Back to clients" }}
      actions={
        <span class="stack-h gap-xs">
          <Button as="a" href={`/clients/${client.id}/edit`} data-variant="tinted">
            Edit
          </Button>
          <Button as="a" href={`/projects/new?client=${client.id}`} data-variant="tinted">
            New project
          </Button>
        </span>
      }
    >
      <dl class="stack-h items-start gap-xl b-all bc-default br-l p-m">
        <Detail label="Projects">{projects.length}</Detail>
        <Detail label="Organizations">{organizations.join(", ") || "None"}</Detail>
        <Detail label="Spent">{formatTotalHours(spentMinutes)}</Detail>
      </dl>
      {projects.length === 0 ? (
        <p class="ink-subtle">No projects yet.</p>
      ) : (
        <ProjectTable projects={projects} groupByClient={false} />
      )}
    </Page>
  );
}
