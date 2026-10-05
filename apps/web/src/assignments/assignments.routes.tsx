import {
  assignmentRates,
  organizations,
  projectAssignments,
  projectOrganizations,
  projects,
  users,
} from "@tid/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { database } from "../database";
import { isIsoDate, todayInOslo } from "../dates/dates";
import { formAction } from "../form/formAction";
import { RatesPage } from "./assignments.views";

// Mounted under /projects/:projectId/assignments.
export const assignments = new Hono();

// Only users from the project's organizations may be assigned to it.
export const inProjectOrganization = (projectId: number) =>
  and(eq(projectOrganizations.orgId, users.orgId), eq(projectOrganizations.projectId, projectId));

const projectPath = (projectId: number) => `/projects/${projectId}`;

function idParams(params: Record<string, string>) {
  const projectId = Number(params.projectId);
  const userId = Number(params.userId);
  return Number.isSafeInteger(projectId) && Number.isSafeInteger(userId)
    ? { projectId, userId }
    : undefined;
}

type AssignmentIds = { projectId: number; userId: number };

const assignment = ({ projectId, userId }: AssignmentIds) =>
  and(eq(projectAssignments.projectId, projectId), eq(projectAssignments.userId, userId));

const ratesOf = ({ projectId, userId }: AssignmentIds) =>
  and(eq(assignmentRates.projectId, projectId), eq(assignmentRates.userId, userId));

const ratesPath = ({ projectId, userId }: AssignmentIds) =>
  `/projects/${projectId}/assignments/${userId}/rates`;

assignments.post("/", async (c) => {
  const ids = idParams({ ...c.req.param(), userId: String((await c.req.parseBody()).userId) });
  if (!ids) return c.notFound();

  // Looking the user up through the project's organizations skips anyone outside them,
  // instead of tripping the foreign key.
  const [user] = await database
    .select({ orgId: users.orgId })
    .from(users)
    .innerJoin(projectOrganizations, inProjectOrganization(ids.projectId))
    .where(eq(users.id, ids.userId));
  if (user) {
    await database
      .insert(projectAssignments)
      .values({ ...ids, orgId: user.orgId })
      .onConflictDoNothing();
  }
  return c.redirect(projectPath(ids.projectId), 303);
});

// Rates hang off the assignment, so they go with it. Logged time keeps its locked rate.
assignments.post("/:userId/delete", async (c) => {
  const ids = idParams(c.req.param());
  if (!ids) return c.notFound();
  await database.transaction(async (transaction) => {
    await transaction.delete(assignmentRates).where(ratesOf(ids));
    await transaction.delete(projectAssignments).where(assignment(ids));
  });
  return c.redirect(projectPath(ids.projectId), 303);
});

const newRateForm = z.object({
  rate: z
    .string()
    .trim()
    .min(1, "Enter a rate")
    .transform(Number)
    .pipe(z.number("Enter a number").min(0, "Can't be negative"))
    // Stored in minor units.
    .transform((rate) => Math.round(rate * 100)),
  validFrom: z.string().refine(isIsoDate, "Pick a date"),
});

assignments.on(
  ["GET", "POST"],
  "/:userId/rates",
  formAction({
    schema: newRateForm,
    loader: async (c) => {
      const ids = idParams(c.req.param());
      if (!ids) return c.notFound();
      const [consultant] = await database
        .select({
          projectId: projectAssignments.projectId,
          userId: projectAssignments.userId,
          name: users.name,
          projectName: projects.name,
          currency: organizations.currency,
        })
        .from(projectAssignments)
        .innerJoin(users, eq(users.id, projectAssignments.userId))
        .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
        .innerJoin(organizations, eq(organizations.id, projectAssignments.orgId))
        .where(assignment(ids));
      if (!consultant) return c.notFound();
      const rates = await database
        .select({ validFrom: assignmentRates.validFrom, rate: assignmentRates.rate })
        .from(assignmentRates)
        .where(ratesOf(ids))
        .orderBy(desc(assignmentRates.validFrom));
      return { consultant, rates, today: todayInOslo() };
    },
    // A rate with the same start date replaces the old one, which is how a rate is edited.
    onSubmit: async (_c, form, { consultant }) => {
      await database
        .insert(assignmentRates)
        .values({ projectId: consultant.projectId, userId: consultant.userId, ...form })
        .onConflictDoUpdate({
          target: [assignmentRates.projectId, assignmentRates.userId, assignmentRates.validFrom],
          set: { rate: form.rate },
        });
      return { redirect: ratesPath(consultant) };
    },
    view: RatesPage,
  }),
);

assignments.post("/:userId/rates/:validFrom/delete", async (c) => {
  const ids = idParams(c.req.param());
  const validFrom = c.req.param("validFrom");
  if (!ids || !isIsoDate(validFrom)) return c.notFound();
  await database
    .delete(assignmentRates)
    .where(and(ratesOf(ids), eq(assignmentRates.validFrom, validFrom)));
  return c.redirect(ratesPath(ids), 303);
});
