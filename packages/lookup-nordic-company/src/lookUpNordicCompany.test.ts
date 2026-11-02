import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { lookUpNordicCompany } from "./lookUpNordicCompany";

const variantNorge = { country: "NO" as const, organizationNumber: "934160770" };
const withKey = { key: "test-key" };

const answer = (status: number, body?: unknown) =>
  spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );

afterEach(() => mock.restore());

test("a registered company comes back with its legal name and address", async () => {
  const fetch = answer(200, {
    name: "VARIANT NORGE AS",
    registeredAddress: { fullAddress: "Kongens gate 36;7012 TRONDHEIM;Norway" },
    legalForm: { code: "NO_AS", name: "Aksjeselskap" },
  });
  expect(await lookUpNordicCompany(variantNorge, withKey)).toEqual({
    outcome: "found",
    company: {
      name: "VARIANT NORGE AS",
      registeredAddress: ["Kongens gate 36", "7012 TRONDHEIM", "Norway"],
    },
  });
  const [, request] = fetch.mock.calls[0] ?? [];
  expect(JSON.parse(String(request?.body))).toEqual({ country: "NO", notation: "934160770" });
  expect(new Headers(request?.headers).get("Ocp-Apim-Subscription-Key")).toBe("test-key");
});

test("an address written with spaces after its semicolons reads the same", async () => {
  answer(200, {
    name: "Volvo AB",
    registeredAddress: { fullAddress: "Queen Street 1; 23456; City of Gold; Sweden" },
  });
  const lookup = await lookUpNordicCompany(variantNorge, withKey);
  expect(lookup.outcome === "found" && lookup.company.registeredAddress).toEqual([
    "Queen Street 1",
    "23456",
    "City of Gold",
    "Sweden",
  ]);
});

test("a number the register doesn't have, or reads as malformed, is not found", async () => {
  answer(404, { title: "Not found", detail: "Organisation does not exist or has been deleted" });
  expect(await lookUpNordicCompany(variantNorge, withKey)).toEqual({ outcome: "notFound" });
  answer(400);
  expect(await lookUpNordicCompany(variantNorge, withKey)).toEqual({ outcome: "notFound" });
});

test("a register that can't answer leaves the company unknown", async () => {
  expect((await lookUpNordicCompany(variantNorge, { key: undefined })).outcome).toBe("unavailable");
  answer(401);
  expect((await lookUpNordicCompany(variantNorge, withKey)).outcome).toBe("unavailable");
  answer(503);
  expect((await lookUpNordicCompany(variantNorge, withKey)).outcome).toBe("unavailable");
  answer(200, { unexpected: true });
  expect((await lookUpNordicCompany(variantNorge, withKey)).outcome).toBe("unavailable");
  spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
  expect((await lookUpNordicCompany(variantNorge, withKey)).outcome).toBe("unavailable");
});
