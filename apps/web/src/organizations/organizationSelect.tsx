import { organizations } from "@tid/db/schema";
import { Button, Label } from "@tid/ui";
import { database } from "../database";

export type OrganizationOption = { id: number; slug: string; name: string };

export const listOrganizations = () =>
  database
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name })
    .from(organizations)
    .orderBy(organizations.name);

/** Submits `organization` to `action`, alongside `keep`, so the page can stay on the same period or tab. */
export function OrganizationSelect({
  organizationSlug,
  organizations,
  action,
  keep = {},
}: {
  organizationSlug: string;
  organizations: OrganizationOption[];
  action?: string;
  keep?: Record<string, string>;
}) {
  return (
    <form method="get" action={action} class="stack-v nowrap gap-3xs">
      {Object.entries(keep).map(([name, value]) => (
        <input type="hidden" name={name} value={value} />
      ))}
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
