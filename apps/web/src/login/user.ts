import type { users } from "@tid/db/schema";

export type User = typeof users.$inferSelect;
/** For routes mounted after `requireUser`, which always sets the user. */
export type UserEnv = { Variables: { user: User } };
/** For routes reachable without logging in, like logging in and signing up. */
export type PublicEnv = { Variables: { user?: User } };
