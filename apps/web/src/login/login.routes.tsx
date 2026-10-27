import { Hono } from "hono";
import type { PublicEnv } from "../domain/users/user";
import { signUp } from "./signUp.command";

export const signupRouter = (...args: Parameters<typeof signUp>) =>
  new Hono<PublicEnv>().on(["GET", "POST"], "/", signUp(...args));
