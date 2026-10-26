import { createMiddleware } from "hono/factory";
import type { UserEnv } from "../login/user";
import { managesProject } from "./manager.data";

// For pages under a project in the URL, as `:id` or, for nested routes, `:projectId`.
export const projectManagersOnly = createMiddleware<UserEnv>(async (c, next) => {
  const projectId = Number(c.req.param("projectId") ?? c.req.param("id"));
  if (!Number.isSafeInteger(projectId)) return c.notFound();
  if (!(await managesProject(c.get("user"), projectId))) {
    return c.text("Only managers of the project's organizations can do this", 403);
  }
  await next();
});

// Any manager, for what belongs to no organization, like clients and new projects, and for
// administering any organization. Month locks check managesOrganization instead, and what belongs
// to a project managesProject.
export const managersOnly = createMiddleware<UserEnv>(async (c, next) => {
  if (!c.get("user").isManager) return c.text("Only managers can do this", 403);
  await next();
});
