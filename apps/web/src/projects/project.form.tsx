import type { clients } from "@tid/db/schema";
import {
  Checkbox,
  Field,
  Fieldset,
  FormError,
  FormField,
  FormPage,
  fieldErrorAttributes,
  Input,
  Label,
  Radio,
  Select,
} from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import { z } from "zod";
import type { OrganizationOption } from "../domain/organizations/organization";
import type { FormState } from "../framework/formAction";
import { emptyAsMissing } from "../framework/formValues";
import { type Billing, billingDescriptions, billingLabels, billings } from "./billing";

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

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
  clientId: z.preprocess(
    emptyAsMissing,
    z.coerce.number({ error: "Choose a client" }).int({ error: "Choose a client" }),
  ),
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
  form: FormState<typeof startProjectForm | typeof editProjectForm>;
};

export function ProjectFormPage({
  billing,
  project,
  clients = [],
  suggestedClientId,
  organizations,
  currencies,
  currency,
  contractOwnerId,
  form,
}: ProjectFormProps) {
  const { values, fieldErrors } = form;
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
    <FormPage
      form={form}
      layer="drawer"
      {...(project
        ? {
            title: `Edit ${project.name}`,
            cancel: `/projects/${project.id}`,
            submit: "Save changes",
          }
        : {
            title: "New project",
            description: (
              <>
                {billingDescriptions[billing]}{" "}
                <a
                  class="v-link"
                  href={`/projects/new${suggestedClientId ? `?${new URLSearchParams({ client: suggestedClientId })}` : ""}`}
                >
                  Change billing
                </a>
              </>
            ),
            cancel: "/projects/new",
            submit: "Create project",
            // It ends on the new project's page, not back on the page it was started from.
            leavesLayer: true,
          })}
    >
      <input type="hidden" name="billing" value={billing} />
      <Fieldset legend="Contract">
        {project ? (
          <div class="stack-v gap-3xs">
            <span class="fs-s ink-subtle">Client</span>
            <span>{project.client}</span>
          </div>
        ) : (
          <Field name="clientId" label="Client" errors={fieldErrors.clientId}>
            <Select
              id="clientId"
              name="clientId"
              required
              selected={selectedClientId}
              options={clients.map((client) => ({ value: client.id, label: client.name }))}
              {...fieldErrorAttributes("clientId", fieldErrors.clientId)}
            >
              <option value="">Choose a client</option>
            </Select>
            <a
              class="v-link fs-s ml-auto"
              href={`/clients/new?${new URLSearchParams({ returnTo: `/projects/new/${billing}` })}`}
              {...{ [attributes.layer]: true }}
            >
              New client
            </a>
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
        <Field name="contractOwnerId" label="Contract owner" errors={fieldErrors.contractOwnerId}>
          <Select
            id="contractOwnerId"
            name="contractOwnerId"
            required={isBillable}
            selected={selectedContractOwnerId}
            options={organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            {...fieldErrorAttributes("contractOwnerId", fieldErrors.contractOwnerId)}
          >
            <option value="" selected={selectedContractOwnerId === ""}>
              {isBillable ? "Choose an organization" : "None"}
            </option>
          </Select>
          <p class="fs-s ink-subtle mt-3xs">
            {isBillable
              ? "The Variant organization that invoices the client."
              : "The organization that owns the project, if any."}
          </p>
        </Field>
        {isBillable &&
          (project?.hasLoggedTime ? (
            <div class="stack-v gap-3xs">
              <span class="fs-s ink-subtle">Currency</span>
              <span>{currency}</span>
              <input type="hidden" name="currency" value={currency} />
            </div>
          ) : (
            <Fieldset class="gap-2xs">
              <Fieldset.Legend class="v-form-label">Currency</Fieldset.Legend>
              <div class="stack-h gap-m">
                {currencies.map((option) => (
                  <Label class="stack-h items-center gap-2xs">
                    <Radio
                      name="currency"
                      value={option}
                      checked={option === selectedCurrency}
                      required
                      {...fieldErrorAttributes("currency", fieldErrors.currency)}
                    />
                    {option}
                  </Label>
                ))}
              </div>
              <p class="fs-s ink-subtle">
                As agreed with the client. It can't change once hours are logged.
              </p>
              {fieldErrors.currency && (
                <FormError id="currency-error" errors={fieldErrors.currency} />
              )}
            </Fieldset>
          ))}
      </Fieldset>
      <Fieldset legend="Project">
        <FormField
          name="name"
          label="Name"
          value={values?.name ?? project?.name}
          errors={fieldErrors.name}
          required
        />
        <Field name="code" label="Code" errors={fieldErrors.code}>
          <Input
            id="code"
            name="code"
            value={values?.code ?? project?.code}
            maxlength={16}
            required
            {...fieldErrorAttributes("code", fieldErrors.code)}
          />
          <p class="fs-s ink-subtle mt-3xs">
            Up to 16 characters.{codeSuggestion && ` Suggestion: ${codeSuggestion}`}
          </p>
        </Field>
        {!isBillable && (
          <div class="b-all bc-subtle py-2xs px-xs br-l surface-tinted">
            <Label class="stack-h items-center gap-xs">
              <Checkbox name="countsTowardBillableBase" checked={countsTowardBillableBase} />
              Counts toward billable base
            </Label>
            <p class="fs-s ink-subtle mt-3xs pl-l w-max-3">
              Untick for absence, like holidays, so it doesn't lower the billable share.
            </p>
          </div>
        )}
      </Fieldset>
      {!project && (
        <Fieldset legend="First task">
          <Field name="firstTask" label="Task name" errors={fieldErrors.firstTask}>
            <Input
              id="firstTask"
              name="firstTask"
              value={values?.firstTask ?? "Consulting"}
              required
              {...fieldErrorAttributes("firstTask", fieldErrors.firstTask)}
            />
            <p class="fs-s ink-subtle mt-3xs">
              {isBillable && "This is what the invoice shows. "}You can add more tasks later.
            </p>
          </Field>
        </Fieldset>
      )}
    </FormPage>
  );
}
