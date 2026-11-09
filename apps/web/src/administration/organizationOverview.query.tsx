import { ActionList, ActionListItem, Button, Page } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import type { Context } from "hono";
import type { UserEnv } from "../domain/users/user";
import { managersPath, openProjectsPath } from "./administration.url";

export const organizationOverview = async (c: Context<UserEnv>) =>
  c.render(<OrganizationOverviewPage ownSlug={c.get("user").organization.slug} />);

// Links name the manager's own organization, which saves each page a redirect to it.
function OrganizationOverviewPage({ ownSlug }: { ownSlug: string }) {
  return (
    <Page title="Administration">
      <ActionList>
        <ActionListItem
          title="Organization details"
          description="Legal name, country, currency and length of the working day"
          action={
            <Button type="button" data-size="small" data-variant="plain">
              Edit
            </Button>
          }
        />
        <ActionListItem
          title="Projects open to everyone"
          description="Everyone can log hours on these"
          action={<ManageLink href={openProjectsPath(ownSlug)} />}
        />
        <ActionListItem
          title="Managers"
          description="Who administers the organization"
          action={<ManageLink href={managersPath(ownSlug)} />}
        />
      </ActionList>
    </Page>
  );
}

function ManageLink({ href }: { href: string }) {
  return (
    <Button
      as="a"
      href={href}
      data-size="small"
      data-variant="plain"
      {...{ [attributes.layer]: true }}
    >
      Manage
    </Button>
  );
}
