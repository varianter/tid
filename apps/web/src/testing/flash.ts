import { Hono } from "hono";
import { takeFlash } from "../framework/flash";

/**
 * The flash a response leaves for the next page, or null for none. It's read through `takeFlash`
 * on a throwaway app, the same way a real page reads it, so the test also covers the cookie.
 */
export async function flashLeftBy(response: Response) {
  const cookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  const nextPage = new Hono().get("/", (c) => c.json(takeFlash(c) ?? null));
  return (await nextPage.request("/", { headers: { Cookie: cookies } })).json();
}
