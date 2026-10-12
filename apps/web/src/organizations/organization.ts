import { organizations } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../database";

export async function findOrganizationBySlug(slug: string) {
  const [organization] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));
  return organization;
}

export async function findOrganizationSlug(orgId: number) {
  const [organization] = await database
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return organization?.slug;
}
