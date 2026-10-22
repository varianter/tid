import type { Country } from "@tid/calendar/publicHolidays";
import { organizations } from "@tid/db/schema";
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
