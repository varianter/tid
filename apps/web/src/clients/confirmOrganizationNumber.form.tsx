import type { CompanyLookup } from "@tid/lookup-nordic-company";
import { FormPage, SummaryList } from "@tid/ui";
import { z } from "zod";
import type { FormState } from "../framework/formAction";
import type { Client } from "./client";
import { formatOrganizationNumber } from "./organizationNumber";

export const confirmOrganizationNumberForm = z.object({});

type ConfirmOrganizationNumberFormPageProps = {
  client: Client;
  organizationNumber: string;
  lookup: CompanyLookup;
  /** Back to the first step, to enter another number. */
  enterAgain: string;
  /** Where the steps end, which cancelling goes to. */
  done: string;
  form: FormState<typeof confirmOrganizationNumberForm>;
};

export function ConfirmOrganizationNumberFormPage({
  client,
  organizationNumber,
  lookup,
  enterAgain,
  done,
  form,
}: ConfirmOrganizationNumberFormPageProps) {
  const formatted = formatOrganizationNumber(organizationNumber);
  const title = `Review organization number for ${client.name}`;
  if (lookup.outcome === "found")
    return (
      <FormPage
        form={form}
        layer="tooltip"
        title={title}
        cancel={done}
        submit="Looks good, use this"
      >
        <div>
          <p class="mb-xs">This is what we found:</p>
          <SummaryList
            rows={[
              { label: "Number", values: [formatted] },
              { label: "Legal name", values: [lookup.company.name] },
              lookup.company.registeredAddress.length > 0 && {
                label: "Address",
                values: lookup.company.registeredAddress,
              },
            ]}
          />
        </div>
      </FormPage>
    );

  if (lookup.outcome === "notFound")
    return (
      <FormPage form={form} layer="tooltip" title={title} cancel={enterAgain}>
        <p>No company in the register has the number {formatted}.</p>
      </FormPage>
    );

  return (
    <FormPage form={form} layer="tooltip" title={title} cancel={done}>
      <p>
        The company register can't be reached right now, so {formatted} can't be checked. Try again
        later.
      </p>
    </FormPage>
  );
}
