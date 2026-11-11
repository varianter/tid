import { DataGrid, EmptyState, Page } from "@tid/ui";
import type { Context } from "hono";
import {
  type OrganizationFilter,
  OrganizationSelect,
} from "../domain/organizations/organizationFilter";
import type { User, UserEnv } from "../domain/users/user";
import { Filtered, PageSearch } from "../framework/filter";
import { returnTo, withQuery } from "../framework/returnTo";
import { resolveAdministeredOrganization } from "./administeredOrganization.data";
import { administrationPath, consultantPickerPath } from "./administration.url";
import { type OrganizationMember, OrganizationMemberTitle } from "./organizationMember";
import { listOrganizationMembers } from "./organizationMember.data";
import { OtherOrganizationNotice } from "./otherOrganizationNotice";

/**
 * A step for any page that needs a consultant: it picks one and goes on to `returnTo` with their
 * `userId`. It knows nothing of the next step, so it can't go anywhere without one.
 */
export const consultantPicker = async (c: Context<UserEnv>) => {
  const next = returnTo(c);
  if (!next) return c.notFound();
  const administered = await resolveAdministeredOrganization(c);
  if (administered instanceof Response) return administered;
  const { organization, filter } = administered;
  const own = c.get("user").organization;
  const members = await listOrganizationMembers(organization.id);
  return c.render(
    // Switching organization keeps `returnTo`.
    <PageSearch.Provider value={new URLSearchParams({ returnTo: next })}>
      <ConsultantPickerPage
        organization={organization}
        filter={filter}
        members={members.map((member) => ({
          ...member,
          href: withQuery(next, { userId: String(member.id) }),
        }))}
        own={own}
        backToOwn={consultantPickerPath(next, own.slug)}
      />
    </PageSearch.Provider>,
  );
};

function ConsultantPickerPage({
  organization,
  filter,
  members,
  own,
  backToOwn,
}: {
  organization: User["organization"];
  filter: OrganizationFilter;
  members: (OrganizationMember & { href: string })[];
  own: User["organization"];
  backToOwn: string;
}) {
  return (
    <Page title="Choose a consultant" back={{ href: administrationPath, label: "Administration" }}>
      <Filtered by={<OrganizationSelect {...filter} />}>
        <OtherOrganizationNotice current={organization} own={own} back={backToOwn} />
        {members.length === 0 ? (
          <EmptyState emoji="👥" title={`No one works in ${organization.name}`}>
            Choose another organization.
          </EmptyState>
        ) : (
          <DataGrid columns={[{ label: "Consultant" }]}>
            {members.map((member) => (
              <DataGrid.Row href={member.href}>
                <OrganizationMemberTitle member={member} />
              </DataGrid.Row>
            ))}
          </DataGrid>
        )}
      </Filtered>
    </Page>
  );
}
