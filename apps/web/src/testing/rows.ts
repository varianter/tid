import { organizations } from "@tid/db/schema";
import { eq } from "drizzle-orm";
import { database } from "../database";

export function onlyRow<Row>(rows: Row[]) {
  const [row] = rows;
  if (!row) throw new Error("Expected a row");
  return row;
}

/** The id of an organization the migrations seed, like `oslo`. */
export async function organizationIdBySlug(slug: string) {
  return onlyRow(await database.select().from(organizations).where(eq(organizations.slug, slug)))
    .id;
}
