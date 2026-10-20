import type { Country } from "@tid/calendar/publicHolidays";
import { organizations } from "@tid/db/schema";
import { Button, Label, Select } from "@tid/ui";
import type { Context } from "hono";
import { database } from "../database";
import type { UserEnv } from "../login/user";

type Organization = typeof organizations.$inferSelect;

/**
 * What a list is narrowed to: one organization, or every organization in a country. It never spans
 * countries, so a page can count on one currency, length of day and holiday calendar.
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

/**
 * The company a list page is narrowed to, or a response to return instead: a redirect that picks
 * the user's own organization when none is given, or not found for an unknown one.
 */
export async function resolveCompany(c: Context<UserEnv>) {
  const companies = listCompanies(
    await database.select().from(organizations).orderBy(organizations.country, organizations.name),
  );
  const value = c.req.query("company");
  if (!value) {
    const own = companies.find(
      (company) =>
        company.organizations.length === 1 && company.organizations[0]?.id === c.get("user").orgId,
    );
    if (!own) return c.notFound();
    const url = new URL(c.req.url);
    url.searchParams.set("company", own.value);
    return c.redirect(`${url.pathname}${url.search}`);
  }
  const selected = companies.find((company) => company.value === value);
  if (!selected) return c.notFound();
  return { selected, companies };
}

/** Submits `company` to the current page, alongside `keep`, so it can stay on the same period or tab. */
export function CompanySelect({
  selected,
  companies,
  keep = {},
}: {
  selected: Company;
  companies: Company[];
  keep?: Record<string, string>;
}) {
  return (
    <auto-submit>
      <form method="get" class="stack-v nowrap gap-3xs">
        {Object.entries(keep).map(([name, value]) => (
          <input type="hidden" name={name} value={value} />
        ))}
        <Label for="company">Company</Label>
        <Select id="company" name="company" data-size="small">
          {[...Map.groupBy(companies, (company) => company.country)].map(([country, members]) => (
            <optgroup label={countryNames[country]}>
              {members.map((company) => (
                <option value={company.value} selected={company.value === selected.value}>
                  {company.name}
                </option>
              ))}
            </optgroup>
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
