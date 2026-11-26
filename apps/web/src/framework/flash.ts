import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";

// Kept in a cookie rather than the URL, so it shows only once: reloading, going back or sharing
// the link won't show it again. It also means nobody can make the app show text by crafting a link.
const flashCookie = "flash";

const flashSchema = z.object({ title: z.string(), message: z.string().optional() });

/** A one-time message for the page a form submission redirects to, saying what it did. */
export type Flash = z.infer<typeof flashSchema>;

/** For a form that edits what's on the page it came from, where nothing new needs naming. */
export const changesSaved: Flash = { title: "Changes saved" };

// Browsers drop a cookie whose name and value exceed 4096 bytes. Hono percent-encodes the value, so
// a message naming something in a non-Latin script can grow past it.
const cookieSizeLimit = 4096;

/**
 * Stores the flash for the next page that renders. A message too long for a cookie is left out,
 * since the title still says what happened.
 */
export function setFlash(c: Context, flash: Flash) {
  const fits = (value: string) =>
    flashCookie.length + encodeURIComponent(value).length <= cookieSizeLimit;
  const full = JSON.stringify(flash);
  setCookie(c, flashCookie, fits(full) ? full : JSON.stringify({ title: flash.title }), {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    // The redirect is followed right away, so an older flash belongs to a page that's long gone.
    maxAge: 60,
  });
}

/** Reads the flash and deletes its cookie, so no later page shows it again. */
export function takeFlash(c: Context): Flash | undefined {
  const cookie = getCookie(c, flashCookie);
  if (cookie === undefined) return undefined;
  deleteCookie(c, flashCookie, { path: "/" });
  return parseFlash(cookie);
}

/** A cookie in the wrong shape shows nothing, like one left over from an older version. */
function parseFlash(cookie: string) {
  try {
    return flashSchema.safeParse(JSON.parse(cookie)).data;
  } catch {
    return undefined;
  }
}
