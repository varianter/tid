import type { clients } from "@tid/db/schema";
import {
  Checkbox,
  Field,
  FormError,
  FormField,
  fieldErrorAttributes,
  Input,
  Label,
  Radio,
  Select,
} from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import type { OrganizationOption } from "../organizations/organization";
import { type Billing, billingLabels, billings } from "./billing";

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

const emptyAsMissing = (value: unknown) => (value === "" ? undefined : value);

const commonFields = {
  name: z.string().trim().min(1, "Enter a name"),
  // The reporting database holds at most 16 characters.
  code: z.string().trim().min(1, "Enter a code").max(16, "At most 16 characters"),
};

// Billable projects are invoiced, so someone invoices them in an agreed currency, and their time
// always counts toward the billable base.
const billableFields = z.object({
  ...commonFields,
  billing: z.enum(["hourly", "fixed_fee"]),
  contractOwnerId: z.preprocess(
    emptyAsMissing,
    z.coerce.number({ error: "Choose the organization that invoices the client" }).int(),
  ),
  currency: z.string().length(3, "Choose the currency agreed with the client"),
});

const nonBillableFields = z.object({
  ...commonFields,
  billing: z.literal("non_billable"),
  // Empty when no organization owns the project.
  contractOwnerId: z.preprocess(emptyAsMissing, z.coerce.number().int().optional()),
  countsTowardBillableBase: checkbox,
});

// A project without tasks can't take hours, so it starts with one.
const startFields = {
  clientId: z.coerce.number().int({ error: "Choose a client" }),
  firstTask: z.string().trim().min(1, "Enter a task name"),
};

export const startProjectForm = z.discriminatedUnion("billing", [
  billableFields.extend(startFields),
  nonBillableFields.extend(startFields),
]);

// The client is fixed once the project exists.
export const editProjectForm = z.discriminatedUnion("billing", [billableFields, nonBillableFields]);

/** The project's own columns for a valid form, whichever billing it has. */
export function projectColumns(form: z.infer<typeof editProjectForm>) {
  const { name, code } = form;
  return form.billing === "non_billable"
    ? {
        name,
        code,
        billing: form.billing,
        currency: null,
        countsTowardBillableBase: form.countsTowardBillableBase,
      }
    : {
        name,
        code,
        billing: form.billing,
        currency: form.currency,
        countsTowardBillableBase: true,
      };
}

export function parseBilling(value: string | undefined): Billing | undefined {
  return billings.find((billing) => billing === value);
}

type ClientOption = typeof clients.$inferSelect & { codeSuggestion?: string };

type ProjectFormProps = {
  /** Picked before the form, since it decides which fields the project has. */
  billing: Billing;
  /** The project being edited. Its client can't change. Omitted when starting one. */
  project?: {
    id: number;
    name: string;
    code: string;
    client: string;
    billing: Billing;
    countsTowardBillableBase: boolean;
    /** Billing and currency are fixed once time is logged, so a project that bills differently is a new one. */
    hasLoggedTime: boolean;
  };
  clients?: ClientOption[];
  suggestedClientId?: string;
  organizations: OrganizationOption[];
  currencies: string[];
  /** Selected until the user picks another. */
  currency: string;
  /** The organization that invoices the client, selected until the user picks another. */
  contractOwnerId: number | null;
};

export const projectFrame = ({ billing, project }: ProjectFormProps) =>
  project
    ? { title: `Edit ${project.name}`, cancel: `/projects/${project.id}`, submit: "Save changes" }
    : {
        title: `New ${billingLabels[billing].toLowerCase()} project`,
        cancel: "/projects/new",
        submit: "Create project",
      };

export function ProjectFields({
  billing,
  project,
  clients = [],
  suggestedClientId,
  organizations,
  currencies,
  currency,
  contractOwnerId,
  values,
  fieldErrors,
}: ProjectFormProps & FormProps) {
  const isBillable = billing !== "non_billable";
  const selectedClientId = values?.clientId ?? suggestedClientId;
  // ponytail: follows the client selected on load only; updating on change needs client-side JS.
  const codeSuggestion = clients.find(
    (client) => String(client.id) === selectedClientId,
  )?.codeSuggestion;
  const countsTowardBillableBase = values
    ? values.countsTowardBillableBase === "on"
    : (project?.countsTowardBillableBase ?? true);
  const selectedCurrency = values?.currency ?? currency;
  const selectedContractOwnerId = values?.contractOwnerId ?? String(contractOwnerId ?? "");
  const otherBillings = billings.filter((other) => other !== billing);
  return (
    <>
      <input type="hidden" name="billing" value={billing} />
      <fieldset class="stack-v gap-m">
        <legend class="fs-l fw-bold mb-s">Contract</legend>
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
              selected={selectedClientId}
              options={clients.map((client) => ({ value: client.id, label: client.name }))}
              {...fieldErrorAttributes("clientId", fieldErrors?.clientId)}
            >
              <option value="">Choose a client</option>
            </Select>
          </Field>
        )}
        {project && (
          <div class="stack-v gap-3xs">
            <span class="fs-s ink-subtle">Billing</span>
            <span>{billingLabels[billing]}</span>
            {project.hasLoggedTime ? (
              <p class="fs-s ink-subtle">
                Hours are logged on this project. Start a new project to bill it differently.
              </p>
            ) : (
              <p class="fs-s">
                Change to{" "}
                {otherBillings.map((other, index) => (
                  <>
                    {index > 0 && " or "}
                    <a href={`/projects/${project.id}/edit?billing=${other}`}>
                      {billingLabels[other].toLowerCase()}
                    </a>
                  </>
                ))}
              </p>
            )}
          </div>
        )}
        <Field name="contractOwnerId" label="Contract owner" errors={fieldErrors?.contractOwnerId}>
          <Select
            id="contractOwnerId"
            name="contractOwnerId"
            required={isBillable}
            selected={selectedContractOwnerId}
            options={organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            {...fieldErrorAttributes("contractOwnerId", fieldErrors?.contractOwnerId)}
          >
            <option value="" selected={selectedContractOwnerId === ""}>
              {isBillable ? "Choose an organization" : "None"}
            </option>
          </Select>
        </Field>
        {isBillable &&
          (project?.hasLoggedTime ? (
            <div class="stack-v gap-3xs">
              <span class="fs-s ink-subtle">Currency</span>
              <span>{currency}</span>
              <input type="hidden" name="currency" value={currency} />
            </div>
          ) : (
            <fieldset class="stack-v gap-2xs">
              <legend class="v-form-label mb-xs">Currency</legend>
              <div class="stack-h gap-m">
                {currencies.map((option) => (
                  <Label class="stack-h items-center gap-2xs">
                    <Radio
                      name="currency"
                      value={option}
                      checked={option === selectedCurrency}
                      required
                      {...fieldErrorAttributes("currency", fieldErrors?.currency)}
                    />
                    {option}
                  </Label>
                ))}
              </div>
              {fieldErrors?.currency && (
                <FormError id="currency-error" errors={fieldErrors.currency} />
              )}
            </fieldset>
          ))}
      </fieldset>
      <fieldset class="stack-v gap-m">
        <legend class="fs-l fw-bold mb-s">Project</legend>
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
        {!isBillable && (
          <div>
            <Label class="stack-h items-center gap-xs">
              <Checkbox name="countsTowardBillableBase" checked={countsTowardBillableBase} />
              Counts toward billable base
            </Label>
            <p class="fs-s ink-subtle mt-3xs">
              Untick for absence, like holidays, so it doesn't lower the billable share.
            </p>
          </div>
        )}
      </fieldset>
      {!project && (
        <fieldset class="stack-v gap-m">
          <legend class="fs-l fw-bold mb-s">First task</legend>
          <Field name="firstTask" label="Task name" errors={fieldErrors?.firstTask}>
            <Input
              id="firstTask"
              name="firstTask"
              value={values?.firstTask ?? "Consulting"}
              required
              {...fieldErrorAttributes("firstTask", fieldErrors?.firstTask)}
            />
            <p class="fs-s ink-subtle mt-3xs">You can add more tasks on the project page.</p>
          </Field>
        </fieldset>
      )}
    </>
  );
}
