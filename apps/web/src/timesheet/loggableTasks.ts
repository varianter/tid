import {
  projectAssignments,
  projectOrganizations,
  projects,
  tasks,
  timeEntries,
  users,
} from "@tid/db/schema";
import { and, eq, exists, or } from "drizzle-orm";
import { database } from "../database";

export type Task = { id: number; name: string; projectId: number; projectName: string };

/** Tasks the user may log on: projects open to their organization's members, assigned ones, and any they already have time on. */
export const loggableBy = (userId: number) =>
  or(
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
    ),
    exists(
      database
        .select()
        .from(projectAssignments)
        .where(
          and(eq(projectAssignments.projectId, projects.id), eq(projectAssignments.userId, userId)),
        ),
    ),
    // Keeps rows for tasks the user is no longer assigned to, so they can still correct them.
    exists(
      database
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.taskId, tasks.id), eq(timeEntries.userId, userId))),
    ),
  );

export const userTasks = () =>
  database
    .select({ id: tasks.id, name: tasks.name, projectId: projects.id, projectName: projects.name })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId));
