import { z } from "zod";
import { idParam, pageUrl } from "../framework/pageUrl";

// The steps that set a client's organization number pass `returnTo` along, so the last one can go
// back to the form that asked for a new client.
const returnToField = { returnTo: z.string().optional().catch(undefined) };

export const enterOrganizationNumberUrl = pageUrl(
  "/clients/:clientId/organization-number",
  z.object({ clientId: idParam, ...returnToField }),
);

/**
 * Reviews `number` against the company register before saving it. Its loader sends a number of no
 * country back to the first step.
 */
export const confirmOrganizationNumberUrl = pageUrl(
  "/clients/:clientId/organization-number/confirm",
  z.object({ clientId: idParam, number: z.string(), ...returnToField }),
);
