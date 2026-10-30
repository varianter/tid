import { ActionList, ActionListItem, Button, Page } from "@tid/ui";
import { attributes } from "@tid/via/attributes";
import type { Context } from "hono";
import type { OrganizationOption } from "../domain/organizations/organization";
import {
  findOrganizationBySlug,
  listOrganizations,
} from "../domain/organizations/organization.data";
import type { UserEnv } from "../domain/users/user";
import { Filtered } from "../framework/filter";
import { administrationPath, managersPath, openProjectsPath } from "./administration.url";
import { OrganizationSwitcher, OtherOrganizationNotice } from "./organizationSwitch";

export const organizationOverviewRedirect = async (c: Context<UserEnv>) => {
  return c.redirect(administrationPath(c.get("user").organization.slug));
};

export const organizationOverview = async (c: Context<UserEnv>) => {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  if (!organization) return c.notFound();
  return c.render(
    <OrganizationOverviewPage
      organization={organization}
      organizations={await listOrganizations()}
      ownOrgId={c.get("user").orgId}
    />,
  );
};

function OrganizationOverviewPage({
  organization,
  organizations,
  ownOrgId,
}: {
  organization: {
    slug: string;
    name: string;
    legalName: string;
    country: string;
    currency: string;
    fullDayMinutes: number;
  };
  organizations: OrganizationOption[];
  ownOrgId: number;
}) {
  return (
    <Page title={`Administration of ${organization.name}`}>
      <Filtered by={<OrganizationSwitcher organizations={organizations} current={organization} />}>
        <OtherOrganizationNotice
          organizations={organizations}
          current={organization}
          ownOrgId={ownOrgId}
        />
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
            action={<ManageLink href={openProjectsPath(organization.slug)} />}
          />
          <ActionListItem
            title="Managers"
            description="Who administers the organization"
            action={<ManageLink href={managersPath(organization.slug)} />}
          />
        </ActionList>
      </Filtered>
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
