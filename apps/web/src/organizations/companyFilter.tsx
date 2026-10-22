import type { Country } from "@tid/calendar/publicHolidays";
import { organizations } from "@tid/db/schema";
import { Label, Select } from "@tid/ui";
import type { Context } from "hono";
import { z } from "zod";
import { database } from "../database";
import type { UserEnv } from "../login/user";
import { countryVisibility } from "../managers/manager";
import { FilterForm } from "../query/queryPage";

type Organization = typeof organizations.$inferSelect;

/**
 * What a list is narrowed to: one organization, or every organization in a country. It never spans
 * countries, so a page can count on one length of day and holiday calendar. Amounts can still be in
 * several currencies, since each project has its own; `currency` is the organizations'.
 */
export type Company = {
  /** The `company` query parameter: an organization's slug, or a lowercase country code. */
  value: string;
  name: string;
  country: Country;
  currency: string;
  fullDayMinutes: number;
  organizations: Organization[];
};

const countryNames: Record<Country, string> = { NO: "Norway", SE: "Sweden" };

/** Each country as a whole, followed by its organizations. */
export function listCompanies(organizations: Organization[]): Company[] {
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

    const companyOf = (name: string, value: string, organizations: Organization[]) => ({
      value,
      name,
      country,
      currency: first.currency,
      fullDayMinutes: first.fullDayMinutes,
      organizations,
    });
    return [
      companyOf(`All of ${countryNames[country]}`, value, members),
      ...members.map((organization) =>
        companyOf(organization.name, organization.slug, [organization]),
      ),
    ];
  });
}

const field = "company";

/** `?company=` names a Company's `value`. Spread into a page's query; `resolveCompany` fills it in when missing. */
export const companyField = { [field]: z.string().optional().catch(undefined) };

/** The company a list page is narrowed to, among those the user may pick. */
export type CompanyFilter = { selected: Company; companies: Company[] };

/**
 * The company a list page is narrowed to, or a response to return instead: a redirect that picks
 * the user's own organization when none is given, or not found for an unknown one or one in a
 * country the user may not see.
 */
export async function resolveCompany(c: Context<UserEnv>): Promise<CompanyFilter | Response> {
  const canViewCountry = await countryVisibility(c.get("user"));
  const companies = listCompanies(
    await database.select().from(organizations).orderBy(organizations.country, organizations.name),
  ).filter((company) => canViewCountry(company.country));
  const value = c.req.query(field);
  if (!value) {
    const own = companies.find(
      (company) =>
        company.organizations.length === 1 && company.organizations[0]?.id === c.get("user").orgId,
    );
    if (!own) return c.notFound();
    const url = new URL(c.req.url);
    url.searchParams.set(field, own.value);
    return c.redirect(`${url.pathname}${url.search}`);
  }
  const selected = companies.find((company) => company.value === value);
  if (!selected) return c.notFound();
  return { selected, companies };
}

export function CompanySelect({ selected, companies }: CompanyFilter) {
  return (
    <FilterForm field={field}>
      <Label for={field}>Company</Label>
      <Select id={field} name={field} data-size="small">
        {[...Map.groupBy(companies, (company) => company.country)].map(([country, members]) => (
          <optgroup>
            <legend>{countryNames[country]}</legend>
            {members.map((company) => (
              <option value={company.value} selected={company.value === selected.value}>
                {company.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </FilterForm>
  );
}
