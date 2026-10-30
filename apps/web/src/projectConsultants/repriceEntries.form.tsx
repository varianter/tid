import { formatDate } from "@tid/calendar/dateDisplay";
import { FormPage } from "@tid/ui";
import { z } from "zod";
import { formatAmount } from "../domain/amount/amount";
import type { FormState } from "../framework/formAction";
import type { Consultant, NewRate } from "./projectConsultant";
import { projectRatesPath } from "./projectConsultants.url";
import { RepricedEntries, type RepricedEntry } from "./repricedEntries";

// Confirming takes no fields; what to reprice comes from the query.
export const repriceEntriesForm = z.object({});

type RepriceEntriesFormPageProps = {
  consultant: Consultant;
  newRate: NewRate;
  entries: RepricedEntry[];
  form: FormState<typeof repriceEntriesForm>;
};

export function RepriceEntriesFormPage({
  consultant,
  newRate,
  entries,
  form,
}: RepriceEntriesFormPageProps) {
  return (
    <FormPage
      title={`New rate for ${consultant.name} from ${formatDate(newRate.validFrom)}`}
      cancel={projectRatesPath(consultant.projectId)}
      submit="Add rate and reprice"
      form={form}
      // The entries it reprices can run long.
      layer="drawer"
      width={6}
    >
      <p>
        {formatAmount(newRate.rate / 100, newRate.currency, 2)} reprices {entries.length} logged{" "}
        {entries.length === 1 ? "entry" : "entries"} on {consultant.projectName}, locked months
        included.
      </p>
      <RepricedEntries entries={entries} price={newRate} currency={newRate.currency} />
    </FormPage>
  );
}
