import type { users } from "@tid/db/schema";
import type { User } from "../login/user";
import { findUserByEmail } from "../login/userIdentity";

export type UserRow = typeof users.$inferSelect;

/** The user as login loads them for a request, so roles changed earlier in a test show. */
export async function loadLoggedInUser({ email }: UserRow): Promise<User> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No user with the email ${email}`);
  return user;
}
