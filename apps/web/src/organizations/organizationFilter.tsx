import type { Country } from "@tid/calendar/publicHolidays";
import { organizations } from "@tid/db/schema";
import { Label, Select } from "@tid/ui";
import type { Context } from "hono";
import { z } from "zod";
import { database } from "../database";
import type { User, UserEnv } from "../login/user";
import { countryVisibility } from "../managers/manager";
import { FilterForm } from "../query/filter";

type Organization = typeof organizations.$inferSelect;

/**
 * What a list is narrowed to: one organization, or every organization in a country. It never spans
 * countries, so a page can count on one length of day and holiday calendar. Amounts can still be in
 * several currencies, since each project has its own; `currency` is the organizations'.
 */
export type OrganizationOption = {
  /** The `organization` query parameter: an organization's slug, or a lowercase country code. */
  value: string;
  name: string;
  country: Country;
  currency: string;
  fullDayMinutes: number;
  organizations: Organization[];
};

const countryNames: Record<Country, string> = { NO: "Norway", SE: "Sweden" };

/** Each country as a whole, followed by its organizations. */
export function listOrganizationOptions(organizations: Organization[]): OrganizationOption[] {
  const byCountry = Map.groupBy(organizations, (organization) => organization.country);
  return [...byCountry].flatMap(([country, members]) => {
    const [first] = members;
    if (!first) return [];
    const mixed = members.find(
      (organization) =>
        organization.currency !== first.currency ||
        organization.fullDayMinutes !== first.fullDayMinutes,
    );
    if (mixed) throw new Error(`${mixed.name} differs from the rest of ${countryNames[country]}`);
    const value = country.toLowerCase();
    const collision = members.find((organization) => organization.slug === value);
    if (collision) throw new Error(`${collision.name}'s slug is taken by its country`);

    const optionOf = (name: string, value: string, organizations: Organization[]) => ({
      value,
      name,
      country,
      currency: first.currency,
      fullDayMinutes: first.fullDayMinutes,
      organizations,
    });
    return [
      optionOf(`All of ${countryNames[country]}`, value, members),
      ...members.map((organization) =>
        optionOf(organization.name, organization.slug, [organization]),
      ),
    ];
  });
}

const field = "organization";

/** `?organization=` names an OrganizationOption's `value`. Spread into a page's query; `resolveOrganizationFilter` fills it in when missing. */
export const organizationField = { [field]: z.string().optional().catch(undefined) };

/** The organizations a list page is narrowed to, among those the user may pick. */
export type OrganizationFilter = { selected: OrganizationOption; options: OrganizationOption[] };

/**
 * The organizations a list page is narrowed to, or a response to return instead: a redirect that picks
 * the user's own organization when none is given, or not found for an unknown one or one in a
 * country the user may not see.
 */
export async function resolveOrganizationFilter(
  c: Context<UserEnv>,
): Promise<OrganizationFilter | Response> {
  const value = c.req.query(field);
  const filter = await findOrganizationFilter(c.get("user"), value);
  if (!filter) return c.notFound();
  if (!value) {
    const url = new URL(c.req.url);
    url.searchParams.set(field, filter.selected.value);
    return c.redirect(`${url.pathname}${url.search}`);
  }
  return filter;
}

/**
 * The options the user may pick, with the one `value` names selected, or their own organization
 * when it names none. Undefined when that isn't one they may pick.
 */
export async function findOrganizationFilter(
  user: User,
  value: string | undefined,
): Promise<OrganizationFilter | undefined> {
  const canViewCountry = countryVisibility(user);
  const allOrganizations = await database
    .select()
    .from(organizations)
    .orderBy(organizations.country, organizations.name);
  const options = listOrganizationOptions(allOrganizations).filter((option) =>
    canViewCountry(option.country),
  );
  const selected = options.find((option) =>
    value
      ? option.value === value
      : option.organizations.length === 1 && option.organizations[0]?.id === user.orgId,
  );
  return selected && { selected, options };
}

/**
 * For `queryPage`'s `complete`: picks the user's own organization when the query names no
 * organization, so a single redirect reaches the canonical URL.
 */
export async function completeOrganization<Query extends { organization?: string }>(
  c: Context<UserEnv>,
  query: Query,
): Promise<Query | Response> {
  if (query.organization) return query;
  const filter = await findOrganizationFilter(c.get("user"), undefined);
  return filter ? { ...query, organization: filter.selected.value } : c.notFound();
}

export function OrganizationSelect({ selected, options }: OrganizationFilter) {
  return (
    <FilterForm field={field}>
      <Label for={field}>Organization</Label>
      <Select
        id={field}
        name={field}
        data-size="small"
        selected={selected.value}
        options={options.map((option) => ({
          value: option.value,
          label: option.name,
          group: countryNames[option.country],
        }))}
      />
    </FilterForm>
  );
}
