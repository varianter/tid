import { formatHours } from "@tid/elements/hours";
import { Badge, Button, DataGrid, Page } from "@tid/ui";
import { z } from "zod";
import { formatAmount } from "../amount/amount";
import { formatDate, formatTableDate } from "../dates/dateDisplay";
import { isIsoDate } from "../dates/isoDate";
import { type FormProps, formAction } from "../form/formAction";
import { type Consultant, idParams, loadConsultant, ratesPath } from "./assignment";
import { addRateAndReprice, entriesToReprice, type NewRate } from "./repricing";

// The rate in minor units, as the rates form passes it on.
const repriceQuery = z.object({
  rate: z.coerce.number().int().min(0),
  validFrom: z.string().refine(isIsoDate),
});

export const repriceEntries = formAction({
  schema: z.object({}),
  loader: async (c) => {
    const ids = idParams(c.req.param());
    const query = repriceQuery.safeParse(c.req.query());
    if (!ids || !query.success) return c.notFound();
    const consultant = await loadConsultant(ids);
    if (!consultant) return c.notFound();
    const newRate = { ...query.data, currency: consultant.currency };
    return { consultant, newRate, entries: await entriesToReprice(ids, newRate) };
  },
  onSubmit: async (_c, _form, { consultant, newRate }) => {
    await addRateAndReprice(consultant, newRate);
    return { redirect: ratesPath(consultant) };
  },
  view: RepricePage,
});

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

function RepricePage({ consultant, newRate, entries }: RepricePageProps) {
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
              {formatTableDate(entry.spentOn)}
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
