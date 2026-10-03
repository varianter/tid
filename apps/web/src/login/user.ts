import type { users } from "@tid/db/schema";

export type User = typeof users.$inferSelect;
export type UserEnv = { Variables: { user?: User } };
