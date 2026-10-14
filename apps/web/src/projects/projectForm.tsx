import type { clients } from "@tid/db/schema";
import {
  Button,
  Checkbox,
  Field,
  FormField,
  fieldErrorAttributes,
  Input,
  Label,
  Page,
  Select,
} from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const projectFields = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  // The reporting database holds at most 16 characters.
  code: z.string().trim().min(1, "Enter a code").max(16, "At most 16 characters"),
  billable: checkbox,
  countsTowardBillableBase: checkbox,
});

export const billableCountsTowardBase = <S extends typeof projectFields>(schema: S) =>
  schema.refine((form) => !form.billable || form.countsTowardBillableBase, {
    message: "Billable projects count toward the billable base",
  });

type ClientOption = typeof clients.$inferSelect & { codeSuggestion?: string };

type ProjectFormPageProps = {
  /** The project being edited. Its client can't change. Omitted when starting one. */
  project?: {
    id: number;
    name: string;
    code: string;
    client: string;
    billable: boolean;
    countsTowardBillableBase: boolean;
  };
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
