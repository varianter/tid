import type { organizations, users } from "@tid/db/schema";

/** Who is logged in, with what most pages ask about them. Login loads it afresh for each request. */
export type User = typeof users.$inferSelect & {
  organization: typeof organizations.$inferSelect;
  isManager: boolean;
};
/** For routes mounted after `requireUser`, which always sets the user. */
export type UserEnv = { Variables: { user: User } };
/** For routes reachable without logging in, like logging in and signing up. */
export type PublicEnv = { Variables: { user?: User } };
