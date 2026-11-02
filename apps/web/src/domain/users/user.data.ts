import { todayInOslo } from "@tid/calendar/osloClock";
import { organizations, users } from "@tid/db/schema";
import { eq, gte, inArray, isNull, or } from "drizzle-orm";
import { database } from "../../framework/database";

/**
 * Everyone who hasn't left, sorted by organization so they group. `alreadyChosen` are included
 * even if they have left, so a form that shows them doesn't drop them on save.
 */
export const listCurrentPeople = (alreadyChosen: number[]) =>
  database
    .select({ id: users.id, name: users.name, orgName: organizations.name })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(
      or(isNull(users.endsOn), gte(users.endsOn, todayInOslo()), inArray(users.id, alreadyChosen)),
    )
    .orderBy(organizations.name, users.name);
