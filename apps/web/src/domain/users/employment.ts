import { users } from "@tid/db/schema";
import { and, gte, isNull, lte, or } from "drizzle-orm";

/** The days someone works at Variant, both included. Either end may be open. */
export type Employment = { firstDay?: string | null; lastDay?: string | null };

/** Users who work at Variant on at least one day from `first` to `last`. */
export const employedDuring = (first: string, last: string) =>
  and(
    or(isNull(users.firstDay), lte(users.firstDay, last)),
    or(isNull(users.lastDay), gte(users.lastDay, first)),
  );
