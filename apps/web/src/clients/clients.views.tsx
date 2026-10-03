import type { clients, projects } from "@tid/db/schema";
import { Button, FormField, Page } from "@tid/ui";
import type { FormProps } from "../form/formAction";

type Client = typeof clients.$inferSelect;
type Project = typeof projects.$inferSelect;

export function ClientsPage({ clients, values, fieldErrors }: { clients: Client[] } & FormProps) {
  return (
    <Page
      title="Clients"
      actions={
        <Button type="button" data-variant="tinted">
          New client
        </Button>
      }
    >
      <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
        {clients.map((client) => (
          <li class="surface-tinted">
            <a href={`/clients/${client.id}`} class="d-block p-xs px-m">
              {client.name}
            </a>
          </li>
        ))}
      </ul>
      <form method="post" class="w-max-5">
        <FormField
          name="name"
          label="Client name"
          value={values?.name}
          errors={fieldErrors?.name}
          required
        />

        <Button class="mt-s" type="submit">
          Add client
        </Button>
      </form>
    </Page>
  );
}

export function ClientPage({ client, projects }: { client: Client; projects: Project[] }) {
  return (
    <Page
      title={client.name}
      back={{ href: "/clients", label: "Back to clients" }}
      actions={
        <Button as="a" href={`/projects/new?client=${client.id}`} data-variant="tinted">
          New project
        </Button>
      }
    >
      {projects.length === 0 ? (
        <p class="ink-subtle">No projects yet.</p>
      ) : (
        <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
          {projects.map((project) => (
            <li class="p-xs px-m surface-tinted">
              {project.name} <span class="ink-subtle">{project.code}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
