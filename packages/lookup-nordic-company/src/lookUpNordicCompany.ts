import { z } from "zod";

// Nordic Smart Government's register API, served by Altinn. `nsg-api-prod.json` describes it.
const endpoint = "https://api.data.altinn.no/nordicinformation/v1/registered-organisations";

export type Country = "NO" | "SE";

export type RegisteredCompany = {
  /** The legal name, as registered: "VARIANT NORGE AS". */
  name: string;
  /** The registered address, one line per part: street, postcode and town, country. */
  registeredAddress: string[];
};

export type CompanyLookup =
  | { outcome: "found"; company: RegisteredCompany }
  | { outcome: "notFound" }
  /** The register couldn't answer, so whether the company exists is unknown. */
  | { outcome: "unavailable"; reason: string };

const registeredOrganisation = z.object({
  name: z.string(),
  // "Kongens gate 36;7012 TRONDHEIM;Norway", sometimes with a space after each semicolon.
  registeredAddress: z.object({ fullAddress: z.string() }).optional(),
});

/** Looks up a company in its country's register. Never throws, since the register is outside our control. */
export async function lookUpNordicCompany(
  { country, organizationNumber }: { country: Country; organizationNumber: string },
  { key, timeoutMs = 5000 }: { key: string | undefined; timeoutMs?: number },
): Promise<CompanyLookup> {
  if (!key) return { outcome: "unavailable", reason: "No subscription key" };
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "Ocp-Apim-Subscription-Key": key,
      },
      body: JSON.stringify({ country, notation: organizationNumber }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { outcome: "unavailable", reason: String(error) };
  }
  // 400 means the register reads the number as malformed, so no company has it either.
  if (response.status === 404 || response.status === 400) return { outcome: "notFound" };
  if (!response.ok) return { outcome: "unavailable", reason: `HTTP ${response.status}` };

  const parsed = registeredOrganisation.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) return { outcome: "unavailable", reason: "Unexpected response" };
  const { name, registeredAddress } = parsed.data;
  return {
    outcome: "found",
    company: {
      name,
      registeredAddress: (registeredAddress?.fullAddress ?? "")
        .split(";")
        .map((line) => line.trim())
        .filter(Boolean),
    },
  };
}
