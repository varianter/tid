import type { HarvestExport } from "./harvestExport";
import type { Findings } from "./plan";

// The organizations in the database, which Harvest accounts are matched to by name.
export type KnownOrganization = { slug: string; name: string; currency: string };

// Each account belongs to the organization with its name, and bills in its currency.
export function matchOrganizations(
  harvestExports: HarvestExport[],
  organizations: KnownOrganization[],
  { problems }: Findings,
) {
  const slugByAccount = new Map<number, string>();
  for (const { account, projects } of harvestExports) {
    const organization = organizations.find((known) => known.name === account.name);
    if (!organization) {
      problems.push(`${account.name}: no organization has this name; add it in a migration.`);
      continue;
    }
    const currencies = new Set(projects.map((project) => project.client.currency));
    currencies.delete(organization.currency);
    if (currencies.size > 0) {
      problems.push(
        `${account.name}: has clients in ${[...currencies].join(", ")}, but the organization uses ${organization.currency}.`,
      );
    }
    slugByAccount.set(account.id, organization.slug);
  }
  return slugByAccount;
}
