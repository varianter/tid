import { formatDate } from "@tid/calendar/dateDisplay";
import { addMonths } from "@tid/calendar/isoDate";
import { formatTotalHours } from "@tid/elements/hours";
import { Button, Checkbox, DataGrid, EmptyState, Label, Page, PeriodNavigation } from "@tid/ui";
import { formatAmount } from "../domain/amount/amount";
import { Filtered, FilterForm } from "../framework/filter";
import { yearsAround } from "../framework/periodNavigation";
import { type QueryProps, queryPage } from "../framework/queryPage";
import { billingLabels } from "../projects/billing";
import {
  invoiceDataCsvUrl,
  invoiceDataPdfUrl,
  invoiceDataZipUrl,
  projectsToInvoiceUrl,
} from "./invoiceData.url";
import { loadProjectsToInvoice, type ProjectToInvoice } from "./projectsToInvoice.data";

export const projectsToInvoice = queryPage({
  url: projectsToInvoiceUrl,
  loader: async (_c, { month, fixedPrice }) => ({
    projects: await loadProjectsToInvoice(month, fixedPrice === true),
  }),
  view: ProjectsToInvoicePage,
});

function ProjectsToInvoicePage({
  projects,
  query,
  href,
}: { projects: ProjectToInvoice[] } & QueryProps<typeof projectsToInvoiceUrl>) {
  const { month } = query;
  return (
    <Page title="Invoice data" description="Hours on billable projects, to support invoicing">
      <Filtered
        by={
          <>
            <FilterForm field="fixedPrice">
              <Label for="fixedPrice" class="stack-h items-center gap-2xs">
                <Checkbox
                  id="fixedPrice"
                  name="fixedPrice"
                  value="yes"
                  checked={query.fixedPrice}
                />
                Include fixed price
              </Label>
            </FilterForm>
            <PeriodNavigation
              previousHref={href({ month: addMonths(month, -1) })}
              nextHref={href({ month: addMonths(month, 1) })}
              previousLabel="Previous month"
              nextLabel="Next month"
              years={yearsAround(month, href)}
            >
              {formatDate(month, "month")}
            </PeriodNavigation>
          </>
        }
      >
        {projects.length === 0 ? (
          <EmptyState emoji="🧾" title="Nothing to invoice">
            No billable hours were logged in {formatDate(month, "month")}.
          </EmptyState>
        ) : (
          <>
            <div>
              <Button as="a" href={invoiceDataZipUrl.path(query)} data-variant="outlined">
                Download all
              </Button>
            </div>
            <DataGrid
              columns={[
                { label: "Client" },
                { label: "Project" },
                { label: "Contract owner" },
                { label: "Invoicing lead" },
                { label: "Billable hours", kind: "number" },
                { label: "Amount", kind: "number" },
                { label: "Download" },
              ]}
            >
              {projects.map((project) => (
                <DataGrid.Row>
                  {project.client}
                  <DataGrid.Title secondary={project.code}>
                    <a href={`/projects/${project.id}`}>{project.name}</a>
                  </DataGrid.Title>
                  {project.contractOwner}
                  {project.invoicingLead ?? ""}
                  {formatTotalHours(project.billableHours * 60)}
                  {project.billing === "hourly" && project.currency
                    ? formatAmount(project.amount, project.currency)
                    : billingLabels[project.billing]}
                  <span class="stack-h gap-s">
                    <a href={invoiceDataPdfUrl.path({ projectId: project.id, month })}>PDF</a>
                    <a href={invoiceDataCsvUrl.path({ projectId: project.id, month })}>CSV</a>
                  </span>
                </DataGrid.Row>
              ))}
            </DataGrid>
          </>
        )}
      </Filtered>
    </Page>
  );
}
