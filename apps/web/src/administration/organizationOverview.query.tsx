import { formatTotalHours } from "@tid/elements/hours";
import { ActionList, ActionListItem, Button, Detail, Page } from "@tid/ui";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import type { OrganizationOption } from "../organizations/organization";
import { findOrganizationBySlug, listOrganizations } from "../organizations/organization.data";
import { Filtered } from "../query/filter";
import { administrationPath, managersPath, openProjectsPath } from "./administrationUrl";
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
        <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m">
          <Detail label="Legal name">{organization.legalName}</Detail>
          <Detail label="Country">{organization.country}</Detail>
          <Detail label="Currency">{organization.currency}</Detail>
          <Detail label="Working day">{formatTotalHours(organization.fullDayMinutes)}</Detail>
        </dl>
        <ActionList>
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
    <Button as="a" href={href} data-size="small" data-variant="plain">
      Manage
    </Button>
  );
}
