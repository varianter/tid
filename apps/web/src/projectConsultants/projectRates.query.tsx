import { formatDate } from "@tid/calendar/dateDisplay";
import { todayInOslo } from "@tid/calendar/osloClock";
import { assignmentRates, projectAssignments, projects, users } from "@tid/db/schema";
import { Badge, DataGrid, Page, Section } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import { and, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { formatAmount } from "../domain/amount/amount";
import { database } from "../framework/database";
import { DeleteRateForm } from "./deleteRate.form";
import { ratesPath } from "./projectConsultants.url";
import { ratePeriods } from "./ratePeriods";

// Only hourly projects have rates.
export const projectRates = async (c: Context) => {
  const id = Number(c.req.param("projectId"));
  if (!Number.isSafeInteger(id)) return c.notFound();
  const [project] = await database
    .select({
      id: projects.id,
      name: projects.name,
      // Hourly projects always have one.
      currency: sql<string>`${projects.currency}`,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.billing, "hourly")));
  if (!project) return c.notFound();
  const consultants = await database
    .select({ userId: users.id, name: users.name })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .where(eq(projectAssignments.projectId, id))
    .orderBy(users.name);
  const rates = await database
    .select({
      userId: assignmentRates.userId,
      validFrom: assignmentRates.validFrom,
      rate: assignmentRates.rate,
    })
    .from(assignmentRates)
    .where(eq(assignmentRates.projectId, id));
  const ratesByConsultant = Map.groupBy(rates, (rate) => rate.userId);
  return c.render(
    <ProjectRatesPage
      project={project}
      consultants={consultants.map((consultant) => ({
        ...consultant,
        rates: ratesByConsultant.get(consultant.userId) ?? [],
      }))}
      today={todayInOslo()}
    />,
  );
};

type ProjectRatesPageProps = {
  project: { id: number; name: string; currency: string };
  consultants: { userId: number; name: string; rates: { validFrom: string; rate: number }[] }[];
  today: string;
};

function ProjectRatesPage({ project, consultants, today }: ProjectRatesPageProps) {
  return (
    <Page
      title={`Billable rates on ${project.name}`}
      back={{ href: `/projects/${project.id}`, label: `Back to ${project.name}` }}
    >
      {consultants.length === 0 && <p class="ink-subtle">No one is assigned yet.</p>}
      {consultants.map((consultant) => {
        const ids = { projectId: project.id, userId: consultant.userId };
        return (
          <Section
            title={consultant.name}
            actions={[
              {
                label: "Add rate",
                href: `${ratesPath(ids)}/new`,
                "aria-label": `Add a rate for ${consultant.name}`,
                [attributes.layer]: true,
              },
            ]}
          >
            {consultant.rates.length === 0 ? (
              <p class="ink-subtle">No rates yet, so their hours have no billable amount.</p>
            ) : (
              <DataGrid
                columns={[
                  { label: "Hourly rate" },
                  { label: "Start date", kind: "fit" },
                  { label: "End date", kind: "fit" },
                  { kind: "action" },
                ]}
              >
                {ratePeriods(consultant.rates, today).map((period) => (
                  <DataGrid.Row>
                    <span>
                      {formatAmount(period.rate / 100, project.currency, 2)}
                      {period.isCurrent && <Badge class="ml-xs">Current</Badge>}
                    </span>
                    {formatDate(period.validFrom, "numeric")}
                    {period.validUntil ? formatDate(period.validUntil, "numeric") : "No end date"}
                    {period.validFrom > today ? (
                      <DeleteRateForm ids={ids} validFrom={period.validFrom} />
                    ) : (
                      ""
                    )}
                  </DataGrid.Row>
                ))}
              </DataGrid>
            )}
          </Section>
        );
      })}
    </Page>
  );
}
