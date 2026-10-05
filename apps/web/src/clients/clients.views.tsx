import type { clients } from "@tid/db/schema";
import { Button, EmptyState, FormField, Page } from "@tid/ui";
import type { FormProps } from "../form/formAction";
import { Detail, formatSpent, type ProjectRow, ProjectTable } from "../projects/projects.views";

type Client = typeof clients.$inferSelect;

type ClientRow = Client & { projectCount: number; spentMinutes: number };

const newClientButton = () => (
  <Button as="a" href="/clients/new" data-variant="tinted">
    New client
  </Button>
);

export function ClientsPage({ clients }: { clients: ClientRow[] }) {
  return (
    <Page title="Clients" actions={newClientButton()}>
      {clients.length === 0 ? (
        <EmptyState emoji="🏢" title="No clients yet" action={newClientButton()} />
      ) : (
        <div
          class="d-grid of-scroll gap-column-l lh-snug t-tabular"
          style="grid-template-columns: minmax(16ch, 1fr) max-content max-content;"
        >
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
            <span>Name</span>
            <span class="ta-right">Projects</span>
            <span class="ta-right">Spent</span>
          </div>
          {clients.map((client) => (
            <a
              href={`/clients/${client.id}`}
              class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s"
            >
              <span class="fw-medium">{client.name}</span>
              <span class="ta-right">{client.projectCount}</span>
              <span class="ta-right">{formatSpent(client.spentMinutes)}</span>
            </a>
          ))}
        </div>
      )}
    </Page>
  );
}

/** Creates a client, or renames `client` when given. */
export function ClientFormPage({ client, values, fieldErrors }: { client?: Client } & FormProps) {
  return (
    <Page
      title={client ? `Edit ${client.name}` : "New client"}
      back={
        client
          ? { href: `/clients/${client.id}`, label: "Back to client" }
          : { href: "/clients", label: "Back to clients" }
      }
    >
      <form method="post" class="stack-v gap-m w-max-5">
        <FormField
          name="name"
          label="Name"
          value={values?.name ?? client?.name}
          errors={fieldErrors?.name}
          required
        />
        <Button type="submit" class="w-max-content">
          {client ? "Save changes" : "Create client"}
        </Button>
      </form>
    </Page>
  );
}

export function ClientPage({ client, projects }: { client: Client; projects: ProjectRow[] }) {
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
        <Detail label="Spent">{formatSpent(spentMinutes)}</Detail>
      </dl>
      {projects.length === 0 ? (
        <p class="ink-subtle">No projects yet.</p>
      ) : (
        <ProjectTable projects={projects} groupByClient={false} />
      )}
    </Page>
  );
}
