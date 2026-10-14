import { Hono } from "hono";
import { signUp } from "./signUp.command";
import type { PublicEnv } from "./user";

export const signupRouter = (...args: Parameters<typeof signUp>) =>
  new Hono<PublicEnv>().on(["GET", "POST"], "/", signUp(...args));
