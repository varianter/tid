import { formatDate } from "@tid/calendar/dateDisplay";
import { todayInOslo } from "@tid/calendar/osloClock";
import { userRoles, users } from "@tid/db/schema";
import { Badge, DataGrid, EmptyState, Page } from "@tid/ui";
import { and, eq, exists, inArray } from "drizzle-orm";
import type { Context } from "hono";
import {
  type OrganizationFilter,
  OrganizationSelect,
  resolveOrganizationFilter,
} from "../domain/organizations/organizationFilter";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { Filtered } from "../framework/filter";
import { consultantPath } from "./consultants.url";
import { loadCurrentBillableProjects } from "./currentBillableProjects.data";

export const consultantList = async (c: Context<UserEnv>) => {
  const organizationFilter = await resolveOrganizationFilter(c);
  if (organizationFilter instanceof Response) return organizationFilter;

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
        organizationFilter.selected.organizations.map((organization) => organization.id),
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
      {...organizationFilter}
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
  options,
}: { consultants: ConsultantRow[] } & OrganizationFilter) {
  return (
    <Page title="Consultants">
      <Filtered by={<OrganizationSelect selected={selected} options={options} />}>
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
