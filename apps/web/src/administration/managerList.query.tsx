import { formatDate } from "@tid/calendar/dateDisplay";
import { userRoles, users } from "@tid/db/schema";
import { Badge, DataGrid, Page } from "@tid/ui";
import { and, eq, exists } from "drizzle-orm";
import type { Context } from "hono";
import { consultantPath } from "../consultants/consultants.url";
import type { OrganizationOption } from "../domain/organizations/organization";
import {
  findOrganizationBySlug,
  listOrganizations,
} from "../domain/organizations/organization.data";
import type { UserEnv } from "../domain/users/user";
import { database } from "../framework/database";
import { Filtered } from "../framework/filter";
import { administrationPath } from "./administration.url";
import { MakeManagerForm } from "./makeManager.form";
import { OrganizationSwitcher, OtherOrganizationNotice } from "./organizationSwitch";
import { RemoveManagerForm } from "./removeManager.form";

export const managerList = async (c: Context<UserEnv>) => {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  if (!organization) return c.notFound();

  const members = await database
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
    .where(eq(users.orgId, organization.id))
    .orderBy(users.name);
  return c.render(
    <ManagerListPage
      organization={organization}
      members={members}
      organizations={await listOrganizations()}
      ownOrgId={c.get("user").orgId}
    />,
  );
};

type MemberRow = {
  id: number;
  name: string;
  email: string;
  endsOn: string | null;
  isManager: boolean;
};

function ManagerListPage({
  organization,
  members,
  organizations,
  ownOrgId,
}: {
  organization: { slug: string; name: string };
  members: MemberRow[];
  organizations: OrganizationOption[];
  ownOrgId: number;
}) {
  return (
    <Page
      title={`Managers in ${organization.name}`}
      layer="drawer"
      back={{ href: administrationPath(organization.slug), label: "Administration" }}
    >
      <Filtered by={<OrganizationSwitcher organizations={organizations} current={organization} />}>
        <OtherOrganizationNotice
          organizations={organizations}
          current={organization}
          ownOrgId={ownOrgId}
        />
        <DataGrid columns={[{ label: "Name" }, { kind: "action" }]}>
          {members.map((member) => (
            <DataGrid.Row>
              <DataGrid.Title
                secondary={[
                  member.email,
                  member.endsOn && `Left Variant ${formatDate(member.endsOn)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                <span class="stack-h gap-xs items-center">
                  <a href={consultantPath(member.id)}>{member.name}</a>
                  {member.isManager && <Badge>Manager</Badge>}
                </span>
              </DataGrid.Title>
              {member.isManager ? (
                <RemoveManagerForm
                  organizationSlug={organization.slug}
                  userId={member.id}
                  name={member.name}
                />
              ) : (
                <MakeManagerForm
                  organizationSlug={organization.slug}
                  userId={member.id}
                  name={member.name}
                />
              )}
            </DataGrid.Row>
          ))}
        </DataGrid>
      </Filtered>
    </Page>
  );
}
