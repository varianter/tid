import { Button, EmptyState, FormField, Page, Table } from "@tid/ui";
import { formatAmount } from "../currency/currency";
import { formatDate } from "../dates/dates";
import type { FormProps } from "../form/formAction";
import { ratePeriods } from "./ratePeriods";

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
                  {period.isCurrent && (
                    <span class="b-all br-s fs-xs ink-prominent ink-subtle ml-xs px-3xs py-3xs surface-tinted">
                      Current
                    </span>
                  )}
                </td>
                <td>{formatDate(period.validFrom)}</td>
                <td>{period.validUntil ? formatDate(period.validUntil) : "All future"}</td>
                <td class="ta-right">
                  <form method="post" action={`${ratesPath}/${period.validFrom}/delete`}>
                    <Button type="submit" data-variant="plain" data-size="small">
                      Delete
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Page>
  );
}
