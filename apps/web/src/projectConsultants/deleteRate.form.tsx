import { formatDate } from "@tid/calendar/dateDisplay";
import { FormPage } from "@tid/ui";
import { z } from "zod";
import { formatAmount } from "../domain/amount/amount";
import type { FormState } from "../framework/formAction";
import type { Consultant, Price } from "./projectConsultant";
import { projectRatesPath } from "./projectConsultants.url";
import { RepricedEntries, type RepricedEntry } from "./repricedEntries";

// Confirming takes no fields; the rate comes from the URL.
export const deleteRateForm = z.object({});

type DeleteRateFormPageProps = {
  consultant: Consultant;
  validFrom: string;
  /** What takes over the rate's period: the rate before it, or none. */
  price: Price;
  entries: RepricedEntry[];
  form: FormState<typeof deleteRateForm>;
};

export function DeleteRateFormPage({
  consultant,
  validFrom,
  price,
  entries,
  form,
}: DeleteRateFormPageProps) {
  const logged = `${entries.length} logged ${entries.length === 1 ? "entry" : "entries"} on ${consultant.projectName}`;
  return (
    <FormPage
      title={`Delete the rate for ${consultant.name} from ${formatDate(validFrom)}`}
      cancel={projectRatesPath(consultant.projectId)}
      submit={entries.length === 0 ? "Delete rate" : "Delete rate and reprice"}
      form={form}
      // The entries it reprices can run long.
      layer={entries.length === 0 ? undefined : "drawer"}
      width={entries.length === 0 ? undefined : 6}
    >
      {entries.length === 0 ? (
        <p>No logged hours change.</p>
      ) : (
        <>
          <p>
            {price
              ? `Deleting it reprices ${logged} at ${formatAmount(price.rate / 100, price.currency, 2)}, the rate before it`
              : `Deleting it leaves ${logged} without a rate`}
            , locked months included.
          </p>
          <RepricedEntries entries={entries} price={price} currency={consultant.currency} />
        </>
      )}
    </FormPage>
  );
}
