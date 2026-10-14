import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const importPath = "/harvest-import";

// Tokens can do anything their owner can in Harvest, so only this page gets them, scripts can't
// read them, and they're gone after an hour.
const tokenCookie = "harvest_tokens";
const tokenCookieOptions = {
  path: importPath,
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
} as const;

export const readHarvestTokens = (c: Context) => getCookie(c, tokenCookie);

export function keepHarvestTokens(c: Context, tokens: string[]) {
  setCookie(c, tokenCookie, tokens.join(","), { ...tokenCookieOptions, maxAge: 60 * 60 });
}

export function deleteHarvestTokens(c: Context) {
  deleteCookie(c, tokenCookie, tokenCookieOptions);
}
