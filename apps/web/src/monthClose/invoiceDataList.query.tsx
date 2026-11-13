import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths } from "@tid/calendar/isoDate";
import { formatTotalHours } from "@tid/elements/hours";
import { Button, ColorMode, DataGrid, EmptyState, Page, PeriodNavigation } from "@tid/ui";
import type { Context } from "hono";
import { formatAmount, formatAmounts, sumAmounts } from "../domain/amount/amount";
import type { UserEnv } from "../domain/users/user";
import { Filtered } from "../framework/filter";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import {
  invoiceDataCsvUrl,
  invoiceDataPdfUrl,
  invoiceDataZipUrl,
} from "../invoiceData/invoiceData.url";
import { sumBillableHours } from "../invoiceData/invoicedHours";
import {
  loadProjectsToInvoice,
  type ProjectToInvoice,
} from "../invoiceData/projectsToInvoice.data";
import { billingLabels } from "../projects/billing";
import { FixedPriceCheckbox } from "../projects/fixedPriceFilter";
import { invoiceDataUrl } from "./monthClose.url";
import { MonthCloseTabs } from "./monthCloseTabs";
import { countLockedOrganizations } from "./monthLock.data";

export const invoiceDataList = queryPage({
  url: invoiceDataUrl,
  loader: async (c: Context<UserEnv>, { month, fixedPrice }) => ({
    projects: await loadProjectsToInvoice(month, fixedPrice === true),
    locks: await countLockedOrganizations(month),
    ownOrganization: c.get("user").organization.slug,
  }),
  view: InvoiceDataListPage,
});

function InvoiceDataListPage({
  projects,
  locks,
  ownOrganization,
  query,
  href,
}: {
  projects: ProjectToInvoice[];
  locks: { organizations: number; locked: number };
  ownOrganization: string;
} & QueryProps<typeof invoiceDataUrl>) {
  const { month } = query;
  const unlocked = locks.organizations - locks.locked;
  return (
    <Page
      title="Month close"
      description="Hours on billable projects, to support invoicing"
      period={
        <PeriodNavigation
          previousHref={href({ month: addMonths(month, -1) })}
          nextHref={href({ month: addMonths(month, 1) })}
          previousLabel="Previous month"
          nextLabel="Next month"
          years={yearsAround(month, href)}
        >
          {formatDate(month, "month")}
        </PeriodNavigation>
      }
    >
      <MonthCloseTabs
        active="invoiceData"
        month={month}
        organization={ownOrganization}
        fixedPrice={query.fixedPrice}
      />
      <Filtered by={<FixedPriceCheckbox />}>
        {projects.length === 0 ? (
          <EmptyState emoji="🧾" title="Nothing to invoice">
            No billable hours were logged in {formatDate(month, "month")}.
          </EmptyState>
        ) : (
          <>
            {unlocked > 0 && (
              <ColorMode
                palette="yellow"
                class="d-block b-all bc-default br-l py-xs px-m ink-default surface-tinted"
              >
                {unlocked} of {locks.organizations} organizations haven't locked{" "}
                {formatDate(month, "month")}, so these numbers may still change.
              </ColorMode>
            )}
            <div>
              <Button as="a" href={invoiceDataZipUrl.path(query)} data-variant="outlined">
                Download all
              </Button>
            </div>
            <DataGrid
              columns={[
                { label: "Client" },
                { label: "Project" },
                { label: "Invoicing lead" },
                { label: "Billable hours", kind: "number" },
                { label: "Amount", kind: "number" },
                { label: "Download", kind: "action" },
              ]}
            >
              {[...Map.groupBy(projects, (project) => project.contractOwner)].map(
                ([contractOwner, owned]) => (
                  <ContractOwnerRows contractOwner={contractOwner} projects={owned} month={month} />
                ),
              )}
            </DataGrid>
          </>
        )}
      </Filtered>
    </Page>
  );
}

/** The projects an organization owns the contract for, and their total. */
function ContractOwnerRows({
  contractOwner,
  projects,
  month,
}: {
  contractOwner: string;
  projects: ProjectToInvoice[];
  month: string;
}) {
  // Only hourly projects have an amount; fixed-price ones are invoiced by their contract.
  const amounts = sumAmounts(projects);
  const [someCurrency] = Object.keys(amounts);
  const hours = sumBillableHours(projects);
  return (
    <>
      <DataGrid.Group>
        <h2 class="fs-xs fw-bold">{contractOwner}</h2>
      </DataGrid.Group>
      {projects.map((project) => (
        <DataGrid.Row>
          {project.client}
          <DataGrid.Title secondary={project.code}>
            <a href={`/projects/${project.id}`}>{project.name}</a>
          </DataGrid.Title>
          {project.invoicingLead ?? ""}
          {formatTotalHours(project.billableHours * 60)}
          {project.billing === "hourly" && project.currency
            ? formatAmount(project.amount, project.currency, "withCurrency")
            : billingLabels[project.billing]}
          <span class="stack-h flex-nowrap gap-xs">
            <Button
              as="a"
              href={invoiceDataPdfUrl.path({ projectId: project.id, month })}
              data-variant="outlined"
              data-size="small"
            >
              PDF
            </Button>
            <Button
              as="a"
              href={invoiceDataCsvUrl.path({ projectId: project.id, month })}
              data-variant="outlined"
              data-size="small"
            >
              CSV
            </Button>
          </span>
        </DataGrid.Row>
      ))}
      <DataGrid.Footer class="mb-m">
        Total
        {""}
        {""}
        <data value={hours}>{formatTotalHours(hours * 60)}</data>
        {someCurrency ? (
          <span class="fw-bold">{formatAmounts(amounts, someCurrency)}</span>
        ) : (
          <span class="ink-subtle">–</span>
        )}
        {""}
      </DataGrid.Footer>
    </>
  );
}
