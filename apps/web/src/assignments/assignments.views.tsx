import { formatHours } from "@tid/elements/hours";
import { Button, EmptyState, FormField, Page, Table } from "@tid/ui";
import { formatAmount } from "../currency/currency";
import { formatDate, formatTableDate } from "../dates/dates";
import type { FormProps } from "../form/formAction";
import { ratePeriods } from "./ratePeriods";
import type { NewRate } from "./repricing";

type RatesPageProps = {
  consultant: {
    projectId: number;
    userId: number;
    name: string;
    projectName: string;
    currency: string;
  };
  rates: { validFrom: string; rate: number }[];
  today: string;
} & FormProps;

export function RatesPage({ consultant, rates, today, values, fieldErrors }: RatesPageProps) {
  const ratesPath = `/projects/${consultant.projectId}/assignments/${consultant.userId}/rates`;
  return (
    <Page
      title={`Billable rates for ${consultant.name}`}
      back={{
        href: `/projects/${consultant.projectId}`,
        label: `Back to ${consultant.projectName}`,
      }}
    >
      <form method="post" class="stack-h items-end gap-xs wrap">
        <FormField
          name="rate"
          label={`Hourly rate (${consultant.currency})`}
          type="number"
          min="0"
          step="0.01"
          value={values?.rate}
          errors={fieldErrors?.rate}
          required
        />
        <FormField
          name="validFrom"
          label="Start date"
          type="date"
          value={values?.validFrom ?? today}
          errors={fieldErrors?.validFrom}
          required
        />
        <Button type="submit">New billable rate</Button>
      </form>
      {rates.length === 0 ? (
        <EmptyState emoji="💰" title="No rates yet">
          Time logged on this project has no billable amount until it has a rate.
        </EmptyState>
      ) : (
        <Table class="t-tabular">
          <thead>
            <tr>
              <th>Hourly rate</th>
              <th>Start date</th>
              <th>End date</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ratePeriods(rates, today).map((period) => (
              <tr>
                <td>
                  {formatAmount(period.rate / 100, consultant.currency, 2)}
                  {period.isCurrent && <span class={badge}>Current</span>}
                </td>
                <td>{formatTableDate(period.validFrom)}</td>
                <td>{period.validUntil ? formatTableDate(period.validUntil) : "All future"}</td>
                <td class="ta-right">
                  {period.validFrom > today && (
                    <form method="post" action={`${ratesPath}/${period.validFrom}/delete`}>
                      <Button type="submit" data-variant="plain" data-size="small">
                        Delete
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Page>
  );
}

type RepricePageProps = {
  consultant: RatesPageProps["consultant"];
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

const badge = "b-all br-s fs-xs ink-prominent ink-subtle ml-xs px-3xs py-3xs surface-tinted";

export function RepricePage({ consultant, newRate, entries }: RepricePageProps) {
  const ratesPath = `/projects/${consultant.projectId}/assignments/${consultant.userId}/rates`;
  const money = (minorUnits: number) => formatAmount(minorUnits / 100, newRate.currency, 2);
  const difference = (entry: RepricePageProps["entries"][number]) =>
    (entry.minutes / 60) * (newRate.rate - (entry.rate ?? 0));
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalDifference = entries.reduce((sum, entry) => sum + difference(entry), 0);
  return (
    <Page
      title={`New rate for ${consultant.name} from ${formatDate(newRate.validFrom)}`}
      back={{ href: ratesPath, label: "Back to billable rates" }}
    >
      <p>
        {money(newRate.rate)} reprices {entries.length} logged{" "}
        {entries.length === 1 ? "entry" : "entries"} on {consultant.projectName}, locked months
        included.
      </p>
      <Table class="t-tabular">
        <thead>
          <tr>
            <th>Date</th>
            <th class="ta-right">Hours</th>
            <th class="ta-right">Old rate</th>
            <th class="ta-right">New rate</th>
            <th class="ta-right">Difference</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr>
              <td>
                <span class="stack-v gap-4xs">
                  <span class="fw-medium">
                    {formatTableDate(entry.spentOn)}
                    {entry.isLocked && <span class={badge}>Locked</span>}
                  </span>
                  <span class="fs-xs ink-subtle">{entry.task}</span>
                </span>
              </td>
              <td class="ta-right">{formatHours(entry.minutes)}</td>
              <td class="ta-right">{entry.rate === null ? "No rate" : money(entry.rate)}</td>
              <td class="ta-right">{money(newRate.rate)}</td>
              <td class="ta-right">{money(difference(entry))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Total</th>
            <td class="ta-right">{formatHours(totalMinutes)}</td>
            <td />
            <td />
            <td class="ta-right">{money(totalDifference)}</td>
          </tr>
        </tfoot>
      </Table>
      <form method="post" class="stack-h gap-xs">
        <Button type="submit">Add rate and reprice</Button>
        <Button as="a" href={ratesPath} data-variant="plain">
          Cancel
        </Button>
      </form>
    </Page>
  );
}
