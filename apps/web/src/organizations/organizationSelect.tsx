import type { Country } from "@tid/calendar/publicHolidays";
import { organizations } from "@tid/db/schema";
import { Button, Label, Select } from "@tid/ui";
import { database } from "../database";

export type OrganizationOption = { id: number; slug: string; name: string; country: Country };

export const listOrganizations = () =>
  database
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      country: organizations.country,
    })
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
    <auto-submit>
      <form method="get" action={action} class="stack-v nowrap gap-3xs">
        {Object.entries(keep).map(([name, value]) => (
          <input type="hidden" name={name} value={value} />
        ))}
        <Label for="organization">Organization</Label>
        <Select id="organization" name="organization" data-size="small">
          {organizations.map((organization) => (
            <option value={organization.slug} selected={organization.slug === organizationSlug}>
              {organization.name}
            </option>
          ))}
        </Select>
        <noscript>
          <Button type="submit" data-size="small">
            Show
          </Button>
        </noscript>
      </form>
    </auto-submit>
  );
}
