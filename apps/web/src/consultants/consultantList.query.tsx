import { formatDate } from "@tid/calendar/dateDisplay";
import { todayInOslo } from "@tid/calendar/osloClock";
import { userRoles, users } from "@tid/db/schema";
import { Badge, DataGrid, EmptyState, Page, Stat, StatList } from "@tid/ui";
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
      orgId: users.orgId,
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
  const today = todayInOslo();
  const projectsByUser = await loadCurrentBillableProjects(
    rows.map((row) => row.id),
    today,
  );
  const officeNames = new Map(
    organizationFilter.selected.organizations.map((organization) => [
      organization.id,
      organization.name,
    ]),
  );
  return c.render(
    <ConsultantListPage
      consultants={rows.map((row) => ({
        ...row,
        officeName: officeNames.get(row.orgId) ?? "",
        hasLeft: row.endsOn !== null && row.endsOn < today,
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
  officeName: string;
  hasLeft: boolean;
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
          <div class="stack-v gap-m">
            <OfficeHeadcounts
              offices={selected.organizations.map((organization) => organization.name)}
              consultants={consultants}
            />
            <DataGrid
              columns={[
                { label: "Name" },
                { label: "Office", kind: "fit" },
                { label: "Billable projects" },
              ]}
            >
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
                  {consultant.officeName}
                  {consultant.projectNames.join(", ")}
                </DataGrid.Row>
              ))}
            </DataGrid>
          </div>
        )}
      </Filtered>
    </Page>
  );
}

/** How many consultants each office has now; those who have left are counted apart. */
function OfficeHeadcounts({
  offices,
  consultants,
}: {
  offices: string[];
  consultants: ConsultantRow[];
}) {
  const byOffice = Map.groupBy(consultants, (consultant) => consultant.officeName);
  return (
    <StatList>
      {offices.map((office) => {
        const members = byOffice.get(office) ?? [];
        const leftCount = members.filter((consultant) => consultant.hasLeft).length;
        return (
          <Stat
            label={office}
            value={String(members.length - leftCount)}
            note={leftCount > 0 ? `${leftCount} have left` : undefined}
          />
        );
      })}
    </StatList>
  );
}
