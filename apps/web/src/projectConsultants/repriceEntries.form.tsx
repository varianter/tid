import { formatDate } from "@tid/calendar/dateDisplay";
import { Form, FormPage } from "@tid/ui";
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
      // The entries it reprices can run long.
      width={6}
    >
      <Form
        cancel={projectRatesPath(consultant.projectId)}
        submit="Add rate and reprice"
        state={form}
      >
        <p>
          {formatAmount(newRate.rate / 100, newRate.currency, "exact")} reprices {entries.length}{" "}
          logged {entries.length === 1 ? "entry" : "entries"} on {consultant.projectName}, locked
          months included.
        </p>
        <RepricedEntries entries={entries} price={newRate} currency={newRate.currency} />
      </Form>
    </FormPage>
  );
}
