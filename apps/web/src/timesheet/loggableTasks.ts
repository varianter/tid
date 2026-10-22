import {
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  users,
} from "@tid/db/schema";
import { and, between, eq, exists, gte, isNull, ne, or } from "drizzle-orm";
import { database } from "../database";

export type Task = { id: number; name: string; projectId: number; projectName: string };

const openToOrganizationOf = (userId: number) =>
  exists(
    database
      .select()
      .from(projectOrganizations)
      .innerJoin(users, eq(users.orgId, projectOrganizations.orgId))
      .where(
        and(
          eq(projectOrganizations.projectId, projects.id),
          eq(projectOrganizations.openToMembers, true),
          eq(users.id, userId),
        ),
      ),
  );

/** Assigned to the project, and when `endedBefore` is given, not rolled off before it. */
const assignedTo = (userId: number, endedBefore?: string) =>
  exists(
    database
      .select()
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.projectId, projects.id),
          eq(projectAssignments.userId, userId),
          endedBefore === undefined
            ? undefined
            : or(isNull(projectAssignments.endsOn), gte(projectAssignments.endsOn, endedBefore)),
        ),
      ),
  );

const loggedOn = (userId: number, from?: string, till?: string) =>
  exists(
    database
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.taskId, tasks.id),
          eq(timeEntries.userId, userId),
          from && till ? between(timeEntries.spentOn, from, till) : undefined,
        ),
      ),
  );

/**
 * Tasks the user may log on: projects open to their organization's members, assigned ones, and any
 * they already have time on. An ended assignment still counts, since its end date is a record,
 * not a lock.
 */
export const loggableBy = (userId: number) =>
  or(openToOrganizationOf(userId), assignedTo(userId), loggedOn(userId));

/** Tasks the timesheet offers between from and till: loggable ones, less projects the user rolled off before then. */
export const offeredTo = (userId: number, from: string, till: string) =>
  or(openToOrganizationOf(userId), assignedTo(userId, from), loggedOn(userId, from, till));

/**
 * Tasks the timesheet shows from the start: billable projects the user is assigned to, unless the
 * assignment or the project ended before from. Start dates are ignored.
 */
export const onBillableAssignment = (userId: number, from: string) =>
  and(
    assignedTo(userId, from),
    ne(projects.billing, "non_billable"),
    or(isNull(projects.endsOn), gte(projects.endsOn, from)),
  );

export const userTasks = () =>
  database
    .select({ id: tasks.id, name: tasks.name, projectId: projects.id, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId));
