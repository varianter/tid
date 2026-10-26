import { formatDate } from "@tid/calendar/dateDisplay";
import { todayInOslo } from "@tid/calendar/osloClock";
import { userRoles, users } from "@tid/db/schema";
import { Badge, DataGrid, EmptyState, Page } from "@tid/ui";
import { and, eq, exists, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { type CompanyFilter, CompanySelect, resolveCompany } from "../organizations/companyFilter";
import { Filtered } from "../query/filter";
import { consultantPath } from "./consultantsUrl";
import { loadCurrentBillableProjects } from "./currentBillableProjects";

export const consultantList = async (c: Context<UserEnv>) => {
  const company = await resolveCompany(c);
  if (company instanceof Response) return company;

  const rows = await database
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      endsOn: users.endsOn,
      isManager: exists(
        database
          .select()
          .from(userRoles)
          .where(and(eq(userRoles.userId, users.id), eq(userRoles.role, "manager"))),
      ).mapWith(Boolean),
    })
    .from(users)
    .where(
      inArray(
        users.orgId,
        company.selected.organizations.map((organization) => organization.id),
      ),
    )
    .orderBy(users.name);
  const projectsByUser = await loadCurrentBillableProjects(
    rows.map((row) => row.id),
    todayInOslo(),
  );
  return c.render(
    <ConsultantListPage
      consultants={rows.map((row) => ({
        ...row,
        projectNames: (projectsByUser.get(row.id) ?? []).map((project) => project.name),
      }))}
      {...company}
    />,
  );
};

type ConsultantRow = {
  id: number;
  name: string;
  email: string;
  endsOn: string | null;
  isManager: boolean;
  projectNames: string[];
};

function ConsultantListPage({
  consultants,
  selected,
  companies,
}: { consultants: ConsultantRow[] } & CompanyFilter) {
  return (
    <Page title="Consultants">
      <Filtered by={<CompanySelect selected={selected} companies={companies} />}>
        {consultants.length === 0 ? (
          <EmptyState emoji="👥" title="No consultants yet" />
        ) : (
          <DataGrid columns={[{ label: "Name" }, { label: "Billable projects" }]}>
            {consultants.map((consultant) => (
              <DataGrid.Row href={consultantPath(consultant.id)}>
                <DataGrid.Title
                  secondary={[
                    consultant.email,
                    consultant.endsOn && `Left Variant ${formatDate(consultant.endsOn)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  <span class="stack-h gap-xs items-center">
                    <span class="fw-medium">{consultant.name}</span>
                    {consultant.isManager && <Badge>Manager</Badge>}
                  </span>
                </DataGrid.Title>
                {consultant.projectNames.join(", ")}
              </DataGrid.Row>
            ))}
          </DataGrid>
        )}
      </Filtered>
    </Page>
  );
}
