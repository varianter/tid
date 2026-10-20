import type { clients } from "@tid/db/schema";
import {
  Button,
  Checkbox,
  Field,
  FormError,
  FormField,
  fieldErrorAttributes,
  Input,
  Label,
  Page,
  Radio,
  Select,
} from "@tid/ui";
import { z } from "zod";
import type { FormProps } from "../form/formAction";
import type { OrganizationOption } from "../organizations/organizationSelect";
import { type Billing, billingLabels, billings } from "./billing";

const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

const projectFields = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  // The reporting database holds at most 16 characters.
  code: z.string().trim().min(1, "Enter a code").max(16, "At most 16 characters"),
  billing: z.enum(billings, { error: "Choose how the project is billed" }),
  currency: z.string().length(3, "Choose a currency"),
  countsTowardBillableBase: checkbox,
  // Empty when no organization invoices the client.
  contractOwnerId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().optional(),
  ),
});

const billingRules = <S extends typeof projectFields>(schema: S) =>
  schema
    .refine((form) => form.billing === "non_billable" || form.countsTowardBillableBase, {
      message: "Billable projects count toward the billable base",
    })
    .refine((form) => form.billing === "non_billable" || form.contractOwnerId !== undefined, {
      message: "Pick the organization that invoices the client",
      path: ["contractOwnerId"],
    });

export const startProjectForm = billingRules(
  projectFields.extend({ clientId: z.coerce.number().int() }),
);

// The client is fixed once the project exists.
export const editProjectForm = billingRules(projectFields);

type ClientOption = typeof clients.$inferSelect & { codeSuggestion?: string };

type ProjectFormPageProps = {
  /** The project being edited. Its client can't change. Omitted when starting one. */
  project?: {
    id: number;
    name: string;
    code: string;
    client: string;
    billing: Billing;
    currency: string;
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
} & FormProps;

export function ProjectFormPage({
  project,
  clients = [],
  suggestedClientId,
  organizations,
  currencies,
  currency,
  contractOwnerId,
  values,
  fieldErrors,
  formError,
}: ProjectFormPageProps) {
  const selectedClientId = values?.clientId ?? suggestedClientId;
  // ponytail: follows the client selected on load only; updating on change needs client-side JS.
  const codeSuggestion = clients.find(
    (client) => String(client.id) === selectedClientId,
  )?.codeSuggestion;
  const countsTowardBillableBase = values
    ? values.countsTowardBillableBase === "on"
    : (project?.countsTowardBillableBase ?? true);
  const selectedBilling = values?.billing ?? project?.billing;
  const selectedCurrency = values?.currency ?? currency;
  const selectedContractOwnerId = values?.contractOwnerId ?? String(contractOwnerId ?? "");
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
        <Field name="contractOwnerId" label="Contract owner" errors={fieldErrors?.contractOwnerId}>
          <Select
            id="contractOwnerId"
            name="contractOwnerId"
            {...fieldErrorAttributes("contractOwnerId", fieldErrors?.contractOwnerId)}
          >
            <option value="" selected={selectedContractOwnerId === ""}>
              None
            </option>
            {organizations.map((organization) => (
              <option
                value={organization.id}
                selected={String(organization.id) === selectedContractOwnerId}
              >
                {organization.name}
              </option>
            ))}
          </Select>
        </Field>
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
        {project?.hasLoggedTime ? (
          <div class="stack-v gap-3xs">
            <span class="fs-s ink-subtle">Billing</span>
            <span>{billingLabels[project.billing]}</span>
            <input type="hidden" name="billing" value={project.billing} />
            <span class="fs-s ink-subtle">Currency</span>
            <span>{project.currency}</span>
            <input type="hidden" name="currency" value={project.currency} />
            <p class="fs-s ink-subtle">
              Time is logged on this project. Start a new project to bill it differently.
            </p>
          </div>
        ) : (
          <>
            <fieldset class="stack-v gap-2xs">
              <legend class="v-form-label">Billing</legend>
              {billings.map((billing) => (
                <Label class="stack-h items-center gap-xs">
                  <Radio
                    name="billing"
                    value={billing}
                    required
                    checked={billing === selectedBilling}
                    {...fieldErrorAttributes("billing", fieldErrors?.billing)}
                  />
                  {billingLabels[billing]}
                </Label>
              ))}
              {fieldErrors?.billing && (
                <FormError id="billing-error" errors={fieldErrors.billing} />
              )}
            </fieldset>
            <Field name="currency" label="Currency" errors={fieldErrors?.currency}>
              <Select
                id="currency"
                name="currency"
                required
                {...fieldErrorAttributes("currency", fieldErrors?.currency)}
              >
                {currencies.map((option) => (
                  <option value={option} selected={option === selectedCurrency}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Label class="stack-h items-center gap-xs">
          <Checkbox name="countsTowardBillableBase" checked={countsTowardBillableBase} />
          Counts toward billable base
        </Label>
        <Button type="submit" class="w-max-content">
          {project ? "Save changes" : "Create project"}
        </Button>
      </form>
    </Page>
  );
}
