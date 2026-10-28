import { projects } from "@tid/db/schema";
import { formatTotalHours } from "@tid/elements/hours";
import { Detail, Page, Section } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { type ProjectSummary, ProjectTable } from "../projects/projectSummary";
import { listProjects } from "../projects/projectSummary.data";
import type { Client } from "./client";
import { findClient } from "./client.data";

export const clientDetails = async (c: Context<UserEnv>) => {
  const client = await findClient(c.req.param("id"));
  if (!client) return c.notFound();
  const clientProjects = await listProjects(eq(projects.clientId, client.id));
  return c.render(
    <ClientDetailsPage
      client={client}
      projects={clientProjects}
      canChange={c.get("user").isManager}
    />,
  );
};

function ClientDetailsPage({
  client,
  projects,
  canChange,
}: {
  client: Client;
  projects: ProjectSummary[];
  /** Only managers change clients and start projects. */
  canChange: boolean;
}) {
  const spentMinutes = projects.reduce((total, project) => total + project.spentMinutes, 0);
  const organizations = [...new Set(projects.flatMap((project) => project.organizations))].sort();
  return (
    <Page
      title={client.name}
      back={{ href: "/clients", label: "Back to clients" }}
      actions={[
        canChange && {
          label: "Edit",
          href: `/clients/${client.id}/edit`,
          [attributes.layer]: true,
        },
        canChange && {
          label: "New project",
          href: `/projects/new?client=${client.id}`,
          [attributes.layer]: true,
        },
      ]}
    >
      <dl class="stack-h items-start gap-xl b-all bc-default br-l p-m">
        <Detail label="Projects">{projects.length}</Detail>
        <Detail label="Organizations">{organizations.join(", ") || "None"}</Detail>
        <Detail label="Hours logged">{formatTotalHours(spentMinutes)}</Detail>
      </dl>
      <Section title="Projects">
        {projects.length === 0 ? (
          <p class="ink-subtle">No projects yet.</p>
        ) : (
          <ProjectTable projects={projects} groupByClient={false} />
        )}
      </Section>
    </Page>
  );
}
