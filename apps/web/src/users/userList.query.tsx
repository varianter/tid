import { organizations, userRoles, users } from "@tid/db/schema";
import { Badge, Button, Label, Page } from "@tid/ui";
import { and, eq, exists } from "drizzle-orm";
import type { Context } from "hono";
import { database } from "../database";
import { formatDate } from "../dates/dateDisplay";
import type { UserEnv } from "../login/user";
import { findOrganizationSlug } from "../organizations/organization";
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
  const organizationOptions = await database
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name })
    .from(organizations)
    .orderBy(organizations.name);
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

type OrganizationOption = { slug: string; name: string };

function OrganizationSelect({
  organizationSlug,
  organizations,
}: {
  organizationSlug: string;
  organizations: OrganizationOption[];
}) {
  return (
    <form method="get" class="stack-h nowrap items-center gap-2xs">
      <Label for="organization">Organization</Label>
      {/* A plain select, since Select's props don't allow an inline handler. */}
      <select
        class="v-select"
        id="organization"
        name="organization"
        data-size="small"
        onchange="this.form.requestSubmit()"
      >
        {organizations.map((organization) => (
          <option value={organization.slug} selected={organization.slug === organizationSlug}>
            {organization.name}
          </option>
        ))}
      </select>
      <noscript>
        <Button type="submit" data-size="small">
          Show
        </Button>
      </noscript>
    </form>
  );
}

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
      <div
        class="d-grid of-scroll gap-column-l lh-snug"
        style="grid-template-columns: minmax(0, 1fr) max-content;"
      >
        <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s ink-subtle fw-bold">
          <span>Name</span>
          <span />
        </div>
        {users.map((user) => (
          <div class="grid-all-columns grid-subgrid items-center b-b bc-subtle p-xs fs-s">
            <span class="stack-v">
              <span class="stack-h gap-xs items-center">
                <span class="fw-medium">{user.name}</span>
                {user.isManager && <Badge>Manager</Badge>}
              </span>
              <span class="ink-subtle" style="overflow-wrap: anywhere;">
                {[user.email, user.endsOn && `Left ${formatDate(user.endsOn)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span class="justify-self-end">
              {user.isManager ? (
                <RemoveManagerForm userId={user.id} organizationSlug={organizationSlug} />
              ) : (
                <MakeManagerForm userId={user.id} organizationSlug={organizationSlug} />
              )}
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
}
