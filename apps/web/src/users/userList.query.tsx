import { userRoles, users } from "@tid/db/schema";
import { Badge, DataGrid, Page } from "@tid/ui";
import { and, eq, exists } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { formatDate } from "../dates/dateDisplay";
import type { UserEnv } from "../login/user";
import { findOrganizationSlug } from "../organizations/organization";
import {
  listOrganizations,
  type OrganizationOption,
  OrganizationSelect,
} from "../organizations/organizationSelect";
import { MakeManagerForm } from "./makeManager.command";
import { RemoveManagerForm } from "./removeManager.command";
import { usersPath } from "./usersUrl";

export const userList = async (c: Context<UserEnv>) => {
  const slug = c.req.query("organization");
  if (!slug) {
    const ownSlug = await findOrganizationSlug(c.get("user").orgId);
    if (!ownSlug) return c.notFound();
    return c.redirect(usersPath(ownSlug));
  }
  const organizationOptions = await listOrganizations();
  const organization = organizationOptions.find((option) => option.slug === slug);
  if (!organization) return c.notFound();

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
    .where(eq(users.orgId, organization.id))
    .orderBy(users.name);
  return c.render(
    <UserListPage users={rows} organizationSlug={slug} organizations={organizationOptions} />,
  );
};

type UserRow = {
  id: number;
  name: string;
  email: string;
  endsOn: string | null;
  isManager: boolean;
};

function UserListPage({
  users,
  organizationSlug,
  organizations,
}: {
  users: UserRow[];
  organizationSlug: string;
  organizations: OrganizationOption[];
}) {
  return (
    <Page
      title="Users"
      actions={
        <OrganizationSelect organizationSlug={organizationSlug} organizations={organizations} />
      }
    >
      <DataGrid columns={[{ label: "Name" }, { kind: "action" }]}>
        {users.map((user) => (
          <DataGrid.Row>
            <DataGrid.Title
              secondary={[user.email, user.endsOn && `Left ${formatDate(user.endsOn)}`]
                .filter(Boolean)
                .join(" · ")}
            >
              <span class="stack-h gap-xs items-center">
                <a href={`/users/${user.id}`}>{user.name}</a>
                {user.isManager && <Badge>Manager</Badge>}
              </span>
            </DataGrid.Title>
            {user.isManager ? (
              <RemoveManagerForm userId={user.id} organizationSlug={organizationSlug} />
            ) : (
              <MakeManagerForm userId={user.id} organizationSlug={organizationSlug} />
            )}
          </DataGrid.Row>
        ))}
      </DataGrid>
    </Page>
  );
}
