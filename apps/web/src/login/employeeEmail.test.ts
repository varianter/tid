import { expect, test } from "bun:test";
import { employeeCountry } from "./employeeEmail";

test("the email domain decides the country, and other domains aren't employees", () => {
  expect(employeeCountry("Kari@Variant.no")).toBe("NO");
  expect(employeeCountry("anna@variant.se")).toBe("SE");
  expect(employeeCountry("kari@variant.no.example.com")).toBeUndefined();
  expect(employeeCountry("kari@notvariant.no")).toBeUndefined();
  expect(employeeCountry("variant.no")).toBeUndefined();
});
