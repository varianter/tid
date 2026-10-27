import { organizations } from "@tid/db/schema";
import { database } from "../framework/database";

/** What a project can be agreed in: any organization's currency, plus euro for foreign clients. */
export async function listProjectCurrencies() {
  const rows = await database
    .selectDistinct({ currency: organizations.currency })
    .from(organizations)
    .orderBy(organizations.currency);
  return [...new Set([...rows.map((row) => row.currency), "EUR"])];
}
