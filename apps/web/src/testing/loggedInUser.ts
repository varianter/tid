import type { users } from "@tid/db/schema";
import { Hono } from "hono";
import type { User, UserEnv } from "../domain/users/user";
import { findUserByEmail } from "../login/userIdentity.data";

export type UserRow = typeof users.$inferSelect;

/** The user as login loads them for a request, so roles changed earlier in a test show. */
export async function loadLoggedInUser({ email }: UserRow): Promise<User> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No user with the email ${email}`);
  return user;
}

/** Sends a request as `user` to the routes `mount` adds, so each test names only its own routes. */
export function requestAsUser(
  user: UserRow,
  mount: (app: Hono<UserEnv>) => Hono<UserEnv>,
  path: string,
  init?: RequestInit,
) {
  const app = mount(
    new Hono<UserEnv>().use(async (c, next) => {
      c.set("user", await loadLoggedInUser(user));
      await next();
    }),
  );
  return app.request(path, init);
}

/** A form post, as a browser sends it, for `requestAsUser`. */
export function postForm(fields: Record<string, string> | [string, string][]): RequestInit {
  return { method: "POST", body: new URLSearchParams(fields) };
}
