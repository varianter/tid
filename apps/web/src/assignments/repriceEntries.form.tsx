import { formatDate } from "@tid/calendar/dateDisplay";
import { formatHours } from "@tid/elements/hours";
import { Badge, Button, DataGrid, Page } from "@tid/ui";
import { z } from "zod";
import { formatAmount } from "../amount/amount";
import type { FormProps } from "../form/formAction";
import { type Consultant, ratesPath } from "./assignment";
import type { NewRate } from "./repricing";

// Confirming takes no fields; what to reprice comes from the query.
export const repriceEntriesForm = z.object({});

type RepricePageProps = {
  consultant: Consultant;
  newRate: NewRate;
  entries: {
    id: number;
    spentOn: string;
    task: string;
    minutes: number;
    rate: number | null;
    isLocked: boolean;
  }[];
} & FormProps;

export function RepricePage({ consultant, newRate, entries }: RepricePageProps) {
  const money = (minorUnits: number) => formatAmount(minorUnits / 100, newRate.currency, 2);
  const difference = (entry: RepricePageProps["entries"][number]) =>
    (entry.minutes / 60) * (newRate.rate - (entry.rate ?? 0));
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalDifference = entries.reduce((sum, entry) => sum + difference(entry), 0);
  return (
    <Page
      title={`New rate for ${consultant.name} from ${formatDate(newRate.validFrom)}`}
      back={{ href: ratesPath(consultant), label: "Back to billable rates" }}
    >
      <p>
        {money(newRate.rate)} reprices {entries.length} logged{" "}
        {entries.length === 1 ? "entry" : "entries"} on {consultant.projectName}, locked months
        included.
      </p>
      <DataGrid
        columns={[
          { label: "Date" },
          { label: "Hours", kind: "number" },
          { label: "Old rate", kind: "number" },
          { label: "New rate", kind: "number" },
          { label: "Difference", kind: "number" },
        ]}
      >
        {entries.map((entry) => (
          <DataGrid.Row>
            <DataGrid.Title secondary={entry.task}>
              {formatDate(entry.spentOn, "numeric")}
              {entry.isLocked && <Badge class="ml-xs">Locked</Badge>}
            </DataGrid.Title>
            {formatHours(entry.minutes)}
            {entry.rate === null ? "No rate" : money(entry.rate)}
            {money(newRate.rate)}
            {money(difference(entry))}
          </DataGrid.Row>
        ))}
        <DataGrid.Footer>
          Total
          {formatHours(totalMinutes)}
          {""}
          {""}
          {money(totalDifference)}
        </DataGrid.Footer>
      </DataGrid>
      <form method="post" class="stack-h gap-xs">
        <Button type="submit">Add rate and reprice</Button>
        <Button as="a" href={ratesPath(consultant)} data-variant="plain">
          Cancel
        </Button>
      </form>
    </Page>
  );
}
