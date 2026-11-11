import { tasks, timeEntries } from "@tid/db/schema";
import { eq, exists, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { database } from "../framework/database";

// Any entry counts, even one of zero minutes: it's still logged on the project. Once there is one,
// the project's billing is settled and it can't be deleted.
export const hasLoggedTime = (projectId: PgColumn | SQL | number) =>
  exists(
    database
      .select()
      .from(timeEntries)
      .innerJoin(tasks, eq(tasks.id, timeEntries.taskId))
      .where(eq(tasks.projectId, projectId)),
  ).mapWith(Boolean);
