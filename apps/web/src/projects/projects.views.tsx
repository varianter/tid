import type { clients } from "@tid/db/schema";
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  FormField,
  fieldErrorAttributes,
  Input,
  Label,
  Page,
  Select,
} from "@tid/ui";
import type { PropsWithChildren } from "hono/jsx";
import { formatHours } from "../dates/dates";
import type { FormProps } from "../form/formAction";

type ProjectRow = {
  id: number;
  name: string;
  code: string;
  client: string;
  spentMinutes: number;
  organizations: string[];
};

type ClientOption = typeof clients.$inferSelect & { codeSuggestion?: string };

type ProjectDetails = {
  name: string;
  code: string;
  billable: boolean;
  clientId: number;
  client: string;
  spentMinutes: number;
  organizations: string[];
};

type TaskTotal = { name: string; spentMinutes: number };

const newProjectButton = () => (
  <Button as="a" href="/projects/new" data-variant="tinted">
    New project
  </Button>
);

export function ProjectsPage({ projects }: { projects: ProjectRow[] }) {
  return (
    <Page title="Projects" actions={newProjectButton()}>
      {projects.length === 0 ? (
        <EmptyState emoji="📁" title="No projects yet" action={newProjectButton()} />
      ) : (
        <div
          class="d-grid of-scroll gap-column-l lh-snug t-tabular"
          style="grid-template-columns: minmax(16ch, 1fr) minmax(12ch, 1fr) minmax(12ch, 1fr) max-content;"
        >
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
            <span>Name</span>
            <span>Client</span>
            <span>Organizations</span>
            <span class="ta-right">Spent</span>
          </div>
          {projects.map((project) => (
            <a
              href={`/projects/${project.id}`}
              class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s"
            >
              <span class="stack-v gap-4xs">
                <span class="fw-medium">{project.name}</span>
                <span class="fs-xs ink-subtle">{project.code}</span>
              </span>
              <span>{project.client}</span>
              <span>{project.organizations.join(", ")}</span>
              <span class="ta-right">{formatSpent(project.spentMinutes)}</span>
            </a>
          ))}
        </div>
      )}
    </Page>
  );
}

export function NewProjectPage({
  clients,
  suggestedClientId,
  values,
  fieldErrors,
}: { clients: ClientOption[]; suggestedClientId?: string } & FormProps) {
  const selectedClientId = values?.clientId ?? suggestedClientId;
  // ponytail: follows the client selected on load only; updating on change needs client-side JS.
  const codeSuggestion = clients.find(
    (client) => String(client.id) === selectedClientId,
  )?.codeSuggestion;
  return (
    <Page title="New project" back={{ href: "/projects", label: "Back to projects" }}>
      <form method="post" class="stack-v gap-m w-max-5">
        <Field name="clientId" label="Client" errors={fieldErrors?.clientId}>
          <Select
            id="clientId"
            name="clientId"
            required
            {...fieldErrorAttributes("clientId", fieldErrors?.clientId)}
          >
            <option value="">Choose a client</option>
            {clients.map((client) => (
              <option value={client.id} selected={String(client.id) === selectedClientId}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <FormField
          name="name"
          label="Name"
          value={values?.name}
          errors={fieldErrors?.name}
          required
        />
        <Field name="code" label="Code" errors={fieldErrors?.code}>
          <Input
            id="code"
            name="code"
            value={values?.code}
            maxlength={16}
            required
            {...fieldErrorAttributes("code", fieldErrors?.code)}
          />
          {codeSuggestion && <p class="fs-s ink-subtle mt-3xs">Suggestion: {codeSuggestion}</p>}
        </Field>
        <Label class="stack-h items-center gap-xs">
          <Checkbox name="billable" checked={values ? values.billable === "on" : true} />
          Billable
        </Label>
        <Button type="submit" class="w-max-content">
          Create project
        </Button>
      </form>
    </Page>
  );
}

export function ProjectPage({ project, tasks }: { project: ProjectDetails; tasks: TaskTotal[] }) {
  return (
    <Page title={project.name} back={{ href: "/projects", label: "Back to projects" }}>
      <dl class="stack-h items-start gap-xl b-all bc-default br-l p-m">
        <Detail label="Client">
          <a href={`/clients/${project.clientId}`}>{project.client}</a>
        </Detail>
        <Detail label="Code">{project.code}</Detail>
        <Detail label="Billable">{project.billable ? "Yes" : "No"}</Detail>
        <Detail label="Organizations">{project.organizations.join(", ") || "None"}</Detail>
        <Detail label="Spent">{formatSpent(project.spentMinutes)}</Detail>
      </dl>
      {tasks.length === 0 ? (
        <p class="ink-subtle">No tasks yet.</p>
      ) : (
        <ul class="stack-v gap-3xs b-all bc-subtle p-2xs t-tabular">
          {tasks.map((task) => (
            <li class="stack-h justify-between p-xs px-m surface-tinted">
              {task.name}
              <span class="ink-subtle">{formatSpent(task.spentMinutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

function formatSpent(minutes: number) {
  return `${formatHours(minutes) || "0"} h`;
}

function Detail({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div class="stack-v gap-3xs">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="fw-medium">{children}</dd>
    </div>
  );
}
