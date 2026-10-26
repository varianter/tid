import { clients, projects } from "@tid/db/schema";
import { eq, type SQL } from "drizzle-orm";
import { database } from "../database";
import { projectSummary } from "./projectSummary";

// Every project, or a client's with `where`, sorted by client so they group.
export const listProjects = (where?: SQL) =>
  database
    .select(projectSummary)
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(where)
    .orderBy(clients.name, projects.name);
