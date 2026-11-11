import { Badge, DataGrid, Page } from "@tid/ui";
import type { Context } from "hono";
import { consultantPath } from "../consultants/consultants.url";
import {
  type OrganizationFilter,
  OrganizationSelect,
} from "../domain/organizations/organizationFilter";
import type { User, UserEnv } from "../domain/users/user";
import { Filtered } from "../framework/filter";
import { resolveAdministeredOrganization } from "./administeredOrganization.data";
import { administrationPath, managersPath } from "./administration.url";
import { MakeManagerForm } from "./makeManager.form";
import { type OrganizationMember, OrganizationMemberTitle } from "./organizationMember";
import { listOrganizationMembers } from "./organizationMember.data";
import { OtherOrganizationNotice } from "./otherOrganizationNotice";
import { RemoveManagerForm } from "./removeManager.form";

export const managerList = async (c: Context<UserEnv>) => {
  const administered = await resolveAdministeredOrganization(c);
  if (administered instanceof Response) return administered;
  const { organization, filter } = administered;

  const members = await listOrganizationMembers(organization.id, { includeLeft: true });
  return c.render(
    <ManagerListPage
      organization={organization}
      filter={filter}
      members={members}
      own={c.get("user").organization}
    />,
  );
};

type MemberRow = OrganizationMember & { isManager: boolean };

function ManagerListPage({
  organization,
  filter,
  members,
  own,
}: {
  organization: User["organization"];
  filter: OrganizationFilter;
  members: MemberRow[];
  own: User["organization"];
}) {
  return (
    <Page
      title={`Managers in ${organization.name}`}
      back={{ href: administrationPath, label: "Administration" }}
    >
      <Filtered by={<OrganizationSelect {...filter} />}>
        <OtherOrganizationNotice current={organization} own={own} back={managersPath(own.slug)} />
        <DataGrid columns={[{ label: "Name" }, { kind: "action" }]}>
          {members.map((member) => (
            <DataGrid.Row>
              <OrganizationMemberTitle member={member}>
                <span class="stack-h gap-xs items-center">
                  <a href={consultantPath(member.id)}>{member.name}</a>
                  {member.isManager && <Badge>Manager</Badge>}
                </span>
              </OrganizationMemberTitle>
              {member.isManager ? (
                <RemoveManagerForm userId={member.id} name={member.name} />
              ) : (
                <MakeManagerForm userId={member.id} name={member.name} />
              )}
            </DataGrid.Row>
          ))}
        </DataGrid>
      </Filtered>
    </Page>
  );
}
