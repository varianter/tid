import { formatDate } from "@tid/calendar/dateDisplay";
import { formatHours } from "@tid/elements/hours";
import { Badge, DataGrid } from "@tid/ui";
import { formatAmount } from "../domain/amount/amount";
import type { Price } from "./projectConsultant";

/** A logged entry that a rate change reprices, at its price before the change. */
export type RepricedEntry = {
  id: number;
  spentOn: string;
  task: string;
  minutes: number;
  rate: number | null;
  isLocked: boolean;
};

/** Each entry a rate change reprices, with its old and new price and what that adds up to. */
export function RepricedEntries({
  entries,
  price,
  currency,
}: {
  entries: RepricedEntry[];
  price: Price;
  currency: string;
}) {
  const money = (minorUnits: number) => formatAmount(minorUnits / 100, currency, 2);
  const difference = (entry: RepricedEntry) =>
    (entry.minutes / 60) * ((price?.rate ?? 0) - (entry.rate ?? 0));
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalDifference = entries.reduce((sum, entry) => sum + difference(entry), 0);
  return (
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
          {price ? money(price.rate) : "No rate"}
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
  );
}
