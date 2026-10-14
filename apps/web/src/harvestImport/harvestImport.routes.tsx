import { organizations } from "@tid/db/schema";
import { fetchHarvestAccounts } from "@tid/harvest/fetch";
import { type ImportPlan, planImport } from "@tid/harvest/plan";
import { describeRejection, writePlan } from "@tid/harvest/write";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { database } from "../database";
import { managesOrganization } from "../endOfTheMonth/manager";
import type { UserEnv } from "../login/user";
import { HarvestImportPage, HarvestTokensPage, type Notice } from "./harvestImport.views";
import { groupPreview } from "./importPreview";

export const harvestImport = new Hono<UserEnv>();

const importPath = "/harvest-import";

// Tokens can do anything their owner can in Harvest, so only this page gets them, scripts can't
// read them, and they're gone after an hour.
const tokenCookie = "harvest_tokens";
const tokenCookieOptions = {
  path: importPath,
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
} as const;

// The import changes everyone's users and projects.
harvestImport.use(async (c, next) => {
  const user = c.get("user");
  if (!(await managesOrganization(user, user.orgId))) {
    return c.text("Only managers can import from Harvest", 403);
  }
  await next();
});

// Ties an apply to the plan that was previewed, so Harvest changing in between isn't applied unseen.
const fingerprint = (plan: ImportPlan) => Bun.hash(JSON.stringify(plan)).toString(36);

async function planFromHarvest(tokens: string) {
  // Named by position, so errors can say which token failed without showing it.
  const namedTokens = Object.fromEntries(
    tokens.split(",").map((token, index) => [`token ${index + 1}`, token]),
  );
  const harvestExports = await fetchHarvestAccounts(namedTokens);
  const known = await database.select().from(organizations);
  const currencies = new Map(
    known.map((organization) => [organization.slug, organization.currency]),
  );
  return { ...planImport(harvestExports, known), currencies };
}

async function preview(tokens: string) {
  try {
    const { plan, problems, warnings, currencies } = await planFromHarvest(tokens);
    if (problems.length > 0) return { problems, warnings };
    const { added, differences } = await writePlan(database, plan, { preview: true });
    return {
      problems,
      warnings,
      additions: groupPreview(plan, added, currencies),
      differences,
      fingerprint: fingerprint(plan),
    };
  } catch (error) {
    return { error: describeRejection(error) };
  }
}

async function renderPreview(
  c: Context<UserEnv>,
  tokens: string,
  messages: { notice?: Notice; applyError?: string } = {},
) {
  return c.render(<HarvestImportPage {...(await preview(tokens))} {...messages} />);
}

const isNotice = (value?: string): value is Notice => value === "applied" || value === "changed";

harvestImport.get("/", (c) => {
  const tokens = getCookie(c, tokenCookie);
  if (!tokens) return c.render(<HarvestTokensPage />);
  const notice = c.req.query("notice");
  return renderPreview(c, tokens, { notice: isNotice(notice) ? notice : undefined });
});

harvestImport.post("/tokens", async (c) => {
  const { tokens } = await c.req.parseBody();
  const cleaned = String(tokens ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);
  if (cleaned.length === 0) {
    c.status(422);
    return c.render(<HarvestTokensPage error="Paste at least one token." />);
  }
  setCookie(c, tokenCookie, cleaned.join(","), { ...tokenCookieOptions, maxAge: 60 * 60 });
  return c.redirect(importPath, 303);
});

harvestImport.post("/forget", (c) => {
  deleteCookie(c, tokenCookie, tokenCookieOptions);
  return c.redirect(importPath, 303);
});

harvestImport.post("/apply", async (c) => {
  const tokens = getCookie(c, tokenCookie);
  if (!tokens) return c.redirect(importPath, 303);
  const body = await c.req.parseBody({ all: true });
  const accepted = new Set([body.accept ?? []].flat().map(String));

  const { plan, problems } = await planFromHarvest(tokens);
  if (problems.length > 0 || fingerprint(plan) !== body.fingerprint) {
    return c.redirect(`${importPath}?notice=changed`, 303);
  }
  try {
    await writePlan(database, plan, { accepted });
  } catch (error) {
    c.status(422);
    return renderPreview(c, tokens, { applyError: describeRejection(error) });
  }
  return c.redirect(`${importPath}?notice=applied`, 303);
});
