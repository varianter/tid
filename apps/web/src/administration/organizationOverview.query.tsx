import { formatTotalHours } from "@tid/elements/hours";
import { ActionList, ActionListItem, Button, Detail, Page } from "@tid/ui";
import type { Context } from "hono";
import type { UserEnv } from "../login/user";
import { findOrganizationBySlug, findOrganizationSlug } from "../organizations/organization";
import { administrationPath, managersPath, openProjectsPath } from "./administrationUrl";

// Managers only administer their own organization.
export const organizationOverviewRedirect = async (c: Context<UserEnv>) => {
  const slug = await findOrganizationSlug(c.get("user").orgId);
  if (!slug) return c.notFound();
  return c.redirect(administrationPath(slug));
};

export const organizationOverview = async (c: Context<UserEnv>) => {
  const organization = await findOrganizationBySlug(c.req.param("organization") ?? "");
  if (!organization) return c.notFound();
  return c.render(<OrganizationOverviewPage organization={organization} />);
};

function OrganizationOverviewPage({
  organization,
}: {
  organization: {
    slug: string;
    name: string;
    legalName: string;
    country: string;
    currency: string;
    fullDayMinutes: number;
  };
}) {
  return (
    <Page title={`Administration of ${organization.name}`}>
      <dl class="stack-h items-start gap-xl gap-row-s b-all bc-default br-l p-m">
        <Detail label="Legal name">{organization.legalName}</Detail>
        <Detail label="Country">{organization.country}</Detail>
        <Detail label="Currency">{organization.currency}</Detail>
        <Detail label="Full day">{formatTotalHours(organization.fullDayMinutes)}</Detail>
      </dl>
      <ActionList>
        <ActionListItem
          title="Projects open to everyone"
          description="Every member can enter hours on these"
          action={<ManageLink href={openProjectsPath(organization.slug)} />}
        />
        <ActionListItem
          title="Managers"
          description="Who administers the organization"
          action={<ManageLink href={managersPath(organization.slug)} />}
        />
      </ActionList>
    </Page>
  );
}

function ManageLink({ href }: { href: string }) {
  return (
    <Button as="a" href={href} data-size="small" data-variant="outlined">
      Manage
    </Button>
  );
}
