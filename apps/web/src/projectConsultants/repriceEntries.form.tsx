import { formatDate } from "@tid/calendar/dateDisplay";
import { formatHours } from "@tid/elements/hours";
import { Badge, DataGrid } from "@tid/ui";
import { z } from "zod";
import { formatAmount } from "../amount/amount";
import type { FormProps } from "../form/formAction";
import type { Consultant, NewRate } from "./projectConsultant";
import { projectRatesPath } from "./projectConsultants.url";

// Confirming takes no fields; what to reprice comes from the query.
export const repriceEntriesForm = z.object({});

type RepriceProps = {
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
};

export const repriceFrame = ({ consultant, newRate }: RepriceProps) => ({
  title: `New rate for ${consultant.name} from ${formatDate(newRate.validFrom)}`,
  cancel: projectRatesPath(consultant.projectId),
  submit: "Add rate and reprice",
});

export function RepriceFields({ consultant, newRate, entries }: RepriceProps & FormProps) {
  const money = (minorUnits: number) => formatAmount(minorUnits / 100, newRate.currency, 2);
  const difference = (entry: RepriceProps["entries"][number]) =>
    (entry.minutes / 60) * (newRate.rate - (entry.rate ?? 0));
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalDifference = entries.reduce((sum, entry) => sum + difference(entry), 0);
  return (
    <>
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
    </>
  );
}
