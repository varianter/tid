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

export type ProjectRow = {
  id: number;
  name: string;
  code: string;
  clientId: number;
  client: string;
  spentMinutes: number;
  organizations: string[];
};

type ClientOption = typeof clients.$inferSelect & { codeSuggestion?: string };

type ProjectDetails = {
  id: number;
  name: string;
  code: string;
  billable: boolean;
  clientId: number;
  client: string;
  spentMinutes: number;
  organizations: string[];
};

type TaskTotal = { name: string; spentMinutes: number };

type Person = { id: number; name: string };

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
        <ProjectTable projects={projects} />
      )}
    </Page>
  );
}

/** Projects with their organizations and time spent, under a heading per client unless `groupByClient` is off. */
export function ProjectTable({
  projects,
  groupByClient = true,
}: {
  projects: ProjectRow[];
  groupByClient?: boolean;
}) {
  return (
    <div
      class="d-grid of-scroll gap-column-l lh-snug t-tabular"
      style="grid-template-columns: minmax(16ch, 1fr) minmax(12ch, 1fr) max-content;"
    >
      <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
        <span>Name</span>
        <span>Organizations</span>
        <span class="ta-right">Spent</span>
      </div>
      {/* Rows arrive sorted by client, so each group is contiguous. */}
      {[...Map.groupBy(projects, (project) => project.clientId).values()].map((group) => (
        <>
          {groupByClient && (
            <a
              href={`/clients/${group[0]?.clientId}`}
              class="grid-all-columns b-b bc-subtle surface-tinted p-xs py-2xs fs-xs ink-subtle fw-bold"
            >
              {group[0]?.client}
            </a>
          )}
          {group.map((project) => (
            <a
              href={`/projects/${project.id}`}
              class="grid-all-columns grid-subgrid items-center b-b bc-subtle bg-wash:hover p-xs fs-s"
            >
              <span class="stack-v gap-4xs">
                <span class="fw-medium">{project.name}</span>
                <span class="fs-xs ink-subtle">{project.code}</span>
              </span>
              <span>{project.organizations.join(", ")}</span>
              <span class="ta-right">{formatSpent(project.spentMinutes)}</span>
            </a>
          ))}
        </>
      ))}
    </div>
  );
}

type ProjectFormPageProps = {
  /** The project being edited. Its client can't change. Omitted when creating. */
  project?: ProjectDetails & { countsTowardBillableBase: boolean };
  clients?: ClientOption[];
  suggestedClientId?: string;
} & FormProps;

export function ProjectFormPage({
  project,
  clients = [],
  suggestedClientId,
  values,
  fieldErrors,
  formError,
}: ProjectFormPageProps) {
  const selectedClientId = values?.clientId ?? suggestedClientId;
  // ponytail: follows the client selected on load only; updating on change needs client-side JS.
  const codeSuggestion = clients.find(
    (client) => String(client.id) === selectedClientId,
  )?.codeSuggestion;
  const checked = (name: "billable" | "countsTowardBillableBase") =>
    values ? values[name] === "on" : (project?.[name] ?? true);
  return (
    <Page
      title={project ? `Edit ${project.name}` : "New project"}
      back={
        project
          ? { href: `/projects/${project.id}`, label: "Back to project" }
          : { href: "/projects", label: "Back to projects" }
      }
    >
      <form method="post" class="stack-v gap-m w-max-5">
        {formError && <p role="alert">{formError}</p>}
        {project ? (
          <div class="stack-v gap-3xs">
            <span class="fs-s ink-subtle">Client</span>
            <span>{project.client}</span>
          </div>
        ) : (
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
        )}
        <FormField
          name="name"
          label="Name"
          value={values?.name ?? project?.name}
          errors={fieldErrors?.name}
          required
        />
        <Field name="code" label="Code" errors={fieldErrors?.code}>
          <Input
            id="code"
            name="code"
            value={values?.code ?? project?.code}
            maxlength={16}
            required
            {...fieldErrorAttributes("code", fieldErrors?.code)}
          />
          {codeSuggestion && <p class="fs-s ink-subtle mt-3xs">Suggestion: {codeSuggestion}</p>}
        </Field>
        <Label class="stack-h items-center gap-xs">
          <Checkbox name="billable" checked={checked("billable")} />
          Billable
        </Label>
        <Label class="stack-h items-center gap-xs">
          <Checkbox name="countsTowardBillableBase" checked={checked("countsTowardBillableBase")} />
          Counts toward billable base
        </Label>
        <Button type="submit" class="w-max-content">
          {project ? "Save changes" : "Create project"}
        </Button>
      </form>
    </Page>
  );
}

type ProjectPageProps = {
  project: ProjectDetails;
  tasks: TaskTotal[];
  assignedPeople: Person[];
  /** People from the project's organizations who aren't assigned yet. */
  assignablePeople: Person[];
};

export function ProjectPage({
  project,
  tasks,
  assignedPeople,
  assignablePeople,
}: ProjectPageProps) {
  const assignmentsPath = `/projects/${project.id}/assignments`;
  return (
    <Page
      title={project.name}
      back={{ href: "/projects", label: "Back to projects" }}
      actions={
        <Button as="a" href={`/projects/${project.id}/edit`} data-variant="tinted">
          Edit
        </Button>
      }
    >
      <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m">
        <Detail label="Client">
          <a href={`/clients/${project.clientId}`}>{project.client}</a>
        </Detail>
        <Detail label="Code">{project.code}</Detail>
        <Detail label="Billable">{project.billable ? "Yes" : "No"}</Detail>
        <Detail label="Organizations">{project.organizations.join(", ") || "None"}</Detail>
        <Detail label="Spent">{formatSpent(project.spentMinutes)}</Detail>
      </dl>
      <section class="stack-v gap-s">
        <div class="stack-h items-center justify-between gap-m wrap">
          <h2 class="fs-l fw-bold">Tasks</h2>
          <form
            method="post"
            action={`/projects/${project.id}/tasks`}
            class="stack-h items-center gap-xs"
          >
            <Input name="name" aria-label="Task name" placeholder="Task name" required />
            <Button type="submit">Add task</Button>
          </form>
        </div>
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
      </section>
      <section class="stack-v gap-s">
        <div class="stack-h items-center justify-between gap-m wrap">
          <h2 class="fs-l fw-bold">Consultants</h2>
          {assignablePeople.length > 0 && (
            <form method="post" action={assignmentsPath} class="stack-h items-center gap-xs">
              <Select name="userId" aria-label="Consultant to assign" required>
                <option value="">Choose a consultant</option>
                {assignablePeople.map((person) => (
                  <option value={person.id}>{person.name}</option>
                ))}
              </Select>
              <Button type="submit">Assign</Button>
            </form>
          )}
        </div>
        {assignedPeople.length === 0 ? (
          <p class="ink-subtle">No one is assigned yet.</p>
        ) : (
          <ul class="stack-v gap-3xs b-all bc-subtle p-2xs">
            {assignedPeople.map((person) => (
              <li class="stack-h items-center justify-between gap-xs p-xs px-m surface-tinted">
                {person.name}
                <span class="stack-h gap-xs">
                  <Button
                    as="a"
                    href={`${assignmentsPath}/${person.id}/rates`}
                    data-variant="plain"
                    data-size="small"
                  >
                    Edit rate
                  </Button>
                  <form method="post" action={`${assignmentsPath}/${person.id}/delete`}>
                    <Button type="submit" data-variant="plain" data-size="small">
                      Remove
                    </Button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}

export function formatSpent(minutes: number) {
  return `${formatHours(minutes) || "0"} h`;
}

export function Detail({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <div class="stack-v gap-3xs">
      <dt class="fs-s ink-subtle">{label}</dt>
      <dd class="fw-medium">{children}</dd>
    </div>
  );
}
